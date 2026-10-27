# Required libraries
import os
import requests
from dotenv import load_dotenv

# Load API key from .env file
load_dotenv()

# Get OpenRouter API key
API_KEY = os.getenv("OPENROUTER_API_KEY")

# OpenRouter API URL
API_URL = "https://openrouter.ai/api/v1/chat/completions"

# AI model
# Free AI model from OpenRouter

MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"

# Function to get AI response from OpenRouter
def get_ai_response(messages):

    # Check API key
    if not API_KEY:
        raise ValueError("OpenRouter API key not found")

    # API request headers
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    # API request data
    payload = {
        "model": MODEL,
        "messages": messages
    }

    # Send request to OpenRouter
    response = requests.post(
        API_URL,
        headers=headers,
        json=payload,
        timeout=60
    )

    # Print error details if request fails
    if response.status_code != 200:
        print("Status Code:", response.status_code)
        print("Error Details:", response.text)

    # Check HTTP errors
    response.raise_for_status()

    # Convert API response into JSON
    data = response.json()

    # Extract AI answer
    answer = data["choices"][0]["message"]["content"]

    # Return answer to app.py
    return answer
