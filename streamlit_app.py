
import streamlit as st
import requests
import os

st.set_page_config(
    page_title="ABC Ride Service",
    page_icon="🚗",
    layout="wide"
)

API_URL = os.getenv(
    "FASTAPI_URL",
    "http://127.0.0.1:8000"
).rstrip("/")

st.title("🚗 ABC Ride Service")
st.caption("Your AI Ride Support Assistant")

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = []

if "chat_id" not in st.session_state:
    st.session_state.chat_id = None

# Display existing messages
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# User input
prompt = st.chat_input("Ask about ABC Ride Service...")

if prompt:
    # Display user message
    st.session_state.messages.append({
        "role": "user",
        "content": prompt
    })

    with st.chat_message("user"):
        st.markdown(prompt)

    # Send message to FastAPI
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            try:
                response = requests.post(
                    f"{API_URL}/chat",
                    json={
                        "chat_id": st.session_state.chat_id,
                        "message": prompt
                    },
                    timeout=120
                )

                response.raise_for_status()
                data = response.json()

                answer = data["answer"]
                st.session_state.chat_id = data["chat_id"]

                st.markdown(answer)

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": answer
                })

            except requests.exceptions.RequestException as error:
                st.error(
                    "Backend connection failed. "
                    "Check whether FastAPI is running."
                )
                st.caption(str(error))

            except (KeyError, ValueError) as error:
                st.error("Unexpected API response.")
                st.caption(str(error))
