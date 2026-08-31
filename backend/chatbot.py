import os
import time

from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY is missing from .env")

client = genai.Client(api_key=api_key)


def get_bot_response(message, conversation_history=None):

    prompt = """
You are a helpful and friendly AI chatbot.
Answer the user's questions clearly and simply.
"""

    if conversation_history:

        for item in conversation_history:

            if item.get("type") == "user" or item.get("sender") == "user":

                prompt += (
                    "\nUser: " +
                    item["message"]
                )

            elif item.get("type") == "ai" or item.get("sender") == "bot":

                prompt += (
                    "\nAssistant: " +
                    item["message"]
                )

    prompt += "\nUser: " + message
    prompt += "\nAssistant:"


    # Try up to 3 times
    for attempt in range(3):

        try:

            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt
            )

            return response.text


        except Exception as error:

            error_text = str(error)

            print(
                f"AI attempt {attempt + 1} failed:"
            )
            print(error_text)


            # Retry only for temporary server problems
            if "503" in error_text or "UNAVAILABLE" in error_text:

                if attempt < 2:

                    print(
                        "Gemini is busy. Retrying..."
                    )

                    time.sleep(2)

                    continue


            return (
                "Sorry, the AI service is temporarily "
                "busy. Please try again."
            )


    return (
        "Sorry, I couldn't get a response "
        "from the AI."
    )