
from uuid import UUID

from database import save_chat_memory, get_chat_memories

# Existing test chat ID
chat_id = UUID("3e1e02bf-ee6f-45e0-ae5c-52e5939aa0a2")

# Save a sample memory for this chat
save_chat_memory(
    chat_id,
    "ride_preference",
    "Prefers airport rides from Noida"
)

print("Memory saved successfully!")

# Retrieve memories for this chat
memories = get_chat_memories(chat_id)

print("\nSaved memories:")
for memory in memories:
    print(f"{memory['memory_key']}: {memory['memory_value']}")
