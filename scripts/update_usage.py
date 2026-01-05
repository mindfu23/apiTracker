import os
import json
import datetime
import smtplib
from email.mime.text import MIMEText

# Mock function to fetch usage - in reality, you would call the respective APIs
def fetch_usage(provider, api_key):
    print(f"Fetching usage for {provider}...")
    # TODO: Implement actual API calls here
    # Example:
    # if provider == 'openai':
    #     response = requests.get('https://api.openai.com/v1/usage', headers={'Authorization': f'Bearer {api_key}'})
    #     return response.json()['total_usage']
    
    # Returning mock data for demonstration
    import random
    return random.randint(0, 1000)

def send_email_notification(subject, body):
    sender_email = os.environ.get('EMAIL_SENDER')
    sender_password = os.environ.get('EMAIL_PASSWORD')
    receiver_email = os.environ.get('EMAIL_RECEIVER')

    if not all([sender_email, sender_password, receiver_email]):
        print("Email configuration missing. Skipping notification.")
        return

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = sender_email
    msg['To'] = receiver_email

    try:
        # Assuming Gmail for this example, but should be configurable
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp_server:
            smtp_server.login(sender_email, sender_password)
            smtp_server.sendmail(sender_email, receiver_email, msg.as_string())
        print("Email sent successfully!")
    except Exception as e:
        print(f"Failed to send email: {e}")

def main():
    providers = ['openai', 'anthropic', 'perplexity', 'gemini', 'huggingface']
    usage_data = {}
    
    for provider in providers:
        api_key = os.environ.get(f"{provider.upper()}_API_KEY")
        if api_key:
            usage = fetch_usage(provider, api_key)
            usage_data[provider] = usage
        else:
            print(f"No API key found for {provider}")
            usage_data[provider] = 0 # Default to 0 if no key

    usage_data['last_updated'] = datetime.datetime.now().isoformat()

    # Write to file
    output_path = os.path.join(os.path.dirname(__file__), '../public/usage.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(usage_data, f, indent=2)
    
    print("Usage data updated.")

    # Check for thresholds and send email
    # Example threshold check
    for provider, usage in usage_data.items():
        if isinstance(usage, int) and usage > 800: # Mock threshold
            send_email_notification(
                f"High API Usage Alert: {provider}",
                f"Your usage for {provider} has reached {usage}."
            )

if __name__ == "__main__":
    main()
