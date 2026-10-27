
import os
import requests
import streamlit as st

st.set_page_config(
    page_title="ABC Ride Service",
    page_icon="🚗",
    layout="centered"
)

API_URL = os.getenv(
    "FASTAPI_URL",
    "http://127.0.0.1:8000"
).rstrip("/")

st.title("🚗 ABC Ride Service")
st.caption("Your AI Ride Support Assistant")


# 1. Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = []

if "chat_id" not in st.session_state:
    st.session_state.chat_id = None


# 2. Load a previous conversation
def load_chat(chat_id):
    response = requests.get(
        f"{API_URL}/chats/{chat_id}/messages",
        timeout=30
    )
    response.raise_for_status()

    data = response.json()

    st.session_state.chat_id = data["chat_id"]
    st.session_state.messages = [
        {
            "role": message["role"],
            "content": message["content"]
        }
        for message in data["messages"]
    ]


# 3. Sidebar: new chat and chat history
with st.sidebar:
    st.header("🚗 ABC Ride Service")

    if st.button("➕ New Chat", use_container_width=True):
        st.session_state.messages = []
        st.session_state.chat_id = None
        st.rerun()

    st.divider()
    st.subheader("💬 Chat History")

    try:
        response = requests.get(
            f"{API_URL}/chats",
            timeout=30
        )
        response.raise_for_status()
        previous_chats = response.json()

        if not previous_chats:
            st.caption("No previous chats yet.")

        for chat in previous_chats:
            previous_chat_id = str(chat["chat_id"])
            title = (chat.get("title") or "New Chat").strip()
            title = title.replace("\n", " ")

            if len(title) > 35:
                title = title[:35] + "..."

            selected = (
                str(st.session_state.chat_id)
                == previous_chat_id
            )

            if st.button(
                f"{'🟢 ' if selected else '💬 '}{title}",
                key=f"chat_{previous_chat_id}",
                use_container_width=True
            ):
                try:
                    load_chat(previous_chat_id)
                    st.rerun()

                except requests.exceptions.RequestException as error:
                    st.error("Could not open this chat.")
                    st.caption(str(error))

    except requests.exceptions.RequestException as error:
        st.error("Could not load chat history.")
        st.caption(str(error))


# 4. Display current conversation
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])


# 5. Chat input
prompt = st.chat_input("Ask about ABC Ride Service...")

if prompt:
    # Display the user's message
    with st.chat_message("user"):
        st.markdown(prompt)

    # Show the assistant's response
    with st.chat_message("assistant"):
        with st.spinner("Checking ABC Ride Service information..."):
            try:
                response = requests.post(
                    f"{API_URL}/chat",
                    json={
                        "chat_id": st.session_state.chat_id,
                        "message": prompt
                    },
                    timeout=120
                )

                if response.status_code >= 400:
                    try:
                        detail = response.json().get(
                            "detail", response.text
                        )
                    except ValueError:
                        detail = response.text

                    st.error(
                        f"API Error {response.status_code}"
                    )
                    st.code(str(detail))
                    st.stop()

                data = response.json()

                st.session_state.chat_id = data["chat_id"]

                # Save messages in the current UI session
                st.session_state.messages.append({
                    "role": "user",
                    "content": prompt
                })

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": data["answer"]
                })

                st.markdown(data["answer"])

            except requests.exceptions.RequestException as error:
                st.error(
                    "Could not connect to FastAPI. "
                    "Check that the backend is running."
                )
                st.code(str(error))

            except (KeyError, ValueError) as error:
                st.error("Unexpected response from FastAPI.")
                st.code(str(error))
