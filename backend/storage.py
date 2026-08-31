import json
import os
import secrets
import threading
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

USERS_FILE = os.path.join(BASE_DIR, "users.json")
CONVERSATIONS_FILE = os.path.join(BASE_DIR, "conversations.json")
FEEDBACK_FILE = os.path.join(BASE_DIR, "feedback.txt")

lock = threading.Lock()


def _read_json(filename, default):
    try:
        if not os.path.exists(filename):
            return default

        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)

        return data

    except (json.JSONDecodeError, OSError):
        return default


def _write_json(filename, data):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


# -------------------------------------------------
# USERS
# -------------------------------------------------

def load_users():
    data = _read_json(USERS_FILE, {"users": []})

    if isinstance(data, list):
        return data

    if "users" not in data:
        data["users"] = []

    return data["users"]


def register_user(username, password):
    username = username.strip()

    if not username or not password:
        return False, "Username and password are required."

    with lock:
        users = load_users()

        for user in users:
            if user["username"].lower() == username.lower():
                return False, "Username already exists."

        users.append({
            "username": username,
            "password": password
        })

        _write_json(USERS_FILE, {"users": users})

    return True, "Account created successfully."


def check_login(username, password):
    users = load_users()

    for user in users:
        if (
            user["username"].lower() == username.strip().lower()
            and user["password"] == password
        ):
            return True

    return False


# -------------------------------------------------
# SHARED GROUP CONVERSATION
# -------------------------------------------------

def _load_conversations():
    data = _read_json(
        CONVERSATIONS_FILE,
        {"conversations": []}
    )

    # Fix old/incorrect JSON format automatically
    if not isinstance(data, dict):
        data = {"conversations": []}

    if "conversations" not in data:
        data["conversations"] = []

    return data


def _load_rooms(data):
    rooms = data.get("rooms", [])

    if not isinstance(rooms, list):
        rooms = []

    data["rooms"] = rooms

    return rooms


def _find_room(data, room_id):
    room_id = room_id.strip().upper()

    for room in _load_rooms(data):
        if room.get("id", "").upper() == room_id:
            return room

    return None


def create_room(username):
    username = username.strip()

    if not username:
        return None

    with lock:
        data = _load_conversations()
        rooms = _load_rooms(data)

        while True:
            room_id = secrets.token_hex(3).upper()

            if not _find_room(data, room_id):
                break

        room = {
            "id": room_id,
            "name": "AI Multi-Chat Room",
            "members": ["AI Assistant", username],
            "messages": []
        }

        rooms.append(room)
        _write_json(CONVERSATIONS_FILE, data)

        return room


def join_room(room_id, username):
    room_id = room_id.strip().upper()
    username = username.strip()

    if not room_id or not username:
        return None

    with lock:
        data = _load_conversations()
        room = _find_room(data, room_id)

        if not room:
            return None

        if username not in room["members"]:
            room["members"].append(username)
            _write_json(CONVERSATIONS_FILE, data)

        return room


def get_room(room_id):
    with lock:
        data = _load_conversations()
        return _find_room(data, room_id)


def get_room_conversation(room_id):
    room = get_room(room_id)
    return room["messages"] if room else None


def get_room_members(room_id):
    room = get_room(room_id)
    return room["members"] if room else None


def save_room_message(room_id, sender, message, message_type="user"):
    with lock:
        data = _load_conversations()
        room = _find_room(data, room_id)

        if not room:
            return None

        if sender not in room["members"] and sender != "AI Assistant":
            room["members"].append(sender)

        new_message = {
            "sender": sender,
            "message": message,
            "type": message_type,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        room["messages"].append(new_message)
        _write_json(CONVERSATIONS_FILE, data)

        return new_message


def _ensure_main_group(data):
    conversations = data["conversations"]

    if not conversations:
        conversations.append({
            "id": "main",
            "name": "AI Multi-Chat",
            "members": [],
            "messages": []
        })

    return conversations[0]


def add_member(username):
    username = username.strip()

    if not username:
        return

    with lock:
        data = _load_conversations()
        group = _ensure_main_group(data)

        if username not in group["members"]:
            group["members"].append(username)
            _write_json(CONVERSATIONS_FILE, data)


def save_message(sender, message, message_type="user"):
    with lock:
        data = _load_conversations()
        group = _ensure_main_group(data)

        # Make sure sender appears in members
        if sender not in group["members"]:
            group["members"].append(sender)

        new_message = {
            "sender": sender,
            "message": message,
            "type": message_type,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        group["messages"].append(new_message)

        _write_json(CONVERSATIONS_FILE, data)

        return new_message


def get_conversation(username=None):
    """
    IMPORTANT:
    Returns the SAME shared conversation to every user.

    username is accepted only for compatibility with the
    existing Flask route.
    """

    with lock:
        data = _load_conversations()
        group = _ensure_main_group(data)

        return group["messages"]


def get_members():
    with lock:
        data = _load_conversations()
        group = _ensure_main_group(data)

        members = []

        for user in load_users():
            registered_username = user.get("username")

            if registered_username and registered_username not in members:
                members.append(registered_username)

        for member in group.get("members", []):
            if member not in members:
                members.append(member)

        return members


def clear_conversation():
    with lock:
        data = _load_conversations()
        group = _ensure_main_group(data)

        group["messages"] = []

        _write_json(CONVERSATIONS_FILE, data)


# -------------------------------------------------
# FEEDBACK
# -------------------------------------------------

def save_feedback(username, feedback):
    with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
        f.write(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
            f"{username}: {feedback}\n"
        )