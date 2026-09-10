import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from storage import (
    register_user,
    check_login,
    save_message,
    get_conversation,
    add_member,
    get_members,
    save_feedback,
    create_room,
    join_room,
    get_room,
    get_room_conversation,
    get_room_members,
    save_room_message
)

from chatbot import get_bot_response


app = Flask(__name__)
CORS(app)


# -------------------------------------------------
# HOME
# -------------------------------------------------

@app.route("/")
def home():
    return jsonify({
        "status": "online",
        "message": "AI Multi-Chat server is running"
    })


# -------------------------------------------------
# REGISTER
# -------------------------------------------------

@app.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()

        username = data.get("username", "").strip()
        password = data.get("password", "")

        success, message = register_user(username, password)

        if success:
            return jsonify({
                "success": True,
                "message": message
            })

        return jsonify({
            "success": False,
            "message": message
        }), 400

    except Exception as e:
        print("REGISTER ERROR:", e)

        return jsonify({
            "success": False,
            "message": "Registration failed."
        }), 500


# -------------------------------------------------
# LOGIN
# -------------------------------------------------

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()

        username = data.get("username", "").strip()
        password = data.get("password", "")

        if check_login(username, password):

            # Add user to the shared group
            add_member(username)

            return jsonify({
                "success": True,
                "message": "Login successful",
                "username": username
            })

        return jsonify({
            "success": False,
            "message": "Invalid username or password"
        }), 401

    except Exception as e:
        print("LOGIN ERROR:", e)

        return jsonify({
            "success": False,
            "message": "Login failed."
        }), 500


# -------------------------------------------------
# SHARED CONVERSATION
# -------------------------------------------------

@app.route("/conversation/<username>", methods=["GET"])
def conversation(username):
    try:
        room = get_room(username)

        if room:
            room_username = request.args.get("username", "").strip()

            if room_username not in room["members"]:
                return jsonify({
                    "success": False,
                    "message": "Join the room before opening it."
                }), 403

            return jsonify({
                "success": True,
                "messages": room["messages"]
            })

        # Make sure user is part of the group
        add_member(username)

        messages = get_conversation(username)

        return jsonify({
            "success": True,
            "messages": messages
        })

    except Exception as e:
        print("CONVERSATION ERROR:", e)

        return jsonify({
            "success": False,
            "message": "Unable to load conversation."
        }), 500


# -------------------------------------------------
# GROUP MEMBERS
# -------------------------------------------------

@app.route("/members", methods=["GET"])
def members():
    try:
        return jsonify({
            "success": True,
            "members": get_members()
        })

    except Exception as e:
        print("MEMBERS ERROR:", e)

        return jsonify({
            "success": False,
            "members": []
        }), 500


@app.route("/create-room", methods=["POST"])
def create_chat_room():
    try:
        data = request.get_json() or {}
        room = create_room(data.get("username", ""))

        if not room:
            return jsonify({
                "success": False,
                "message": "Username is required."
            }), 400

        return jsonify({"success": True, "room": room})
    except Exception as e:
        print("CREATE ROOM ERROR:", e)
        return jsonify({
            "success": False,
            "message": "Unable to create room."
        }), 500


@app.route("/join-room", methods=["POST"])
def join_chat_room():
    try:
        data = request.get_json() or {}
        room = join_room(
            data.get("room_id", ""),
            data.get("username", "")
        )

        if not room:
            return jsonify({
                "success": False,
                "message": "Room not found."
            }), 404

        return jsonify({"success": True, "room": room})
    except Exception as e:
        print("JOIN ROOM ERROR:", e)
        return jsonify({
            "success": False,
            "message": "Unable to join room."
        }), 500


@app.route("/rooms/<room_id>", methods=["GET"])
def room_details(room_id):
    room = get_room(room_id)

    if not room:
        return jsonify({
            "success": False,
            "message": "Room not found."
        }), 404

    return jsonify({"success": True, "room": room})


@app.route("/rooms/<room_id>/members", methods=["GET"])
def room_members(room_id):
    members = get_room_members(room_id)

    if members is None:
        return jsonify({
            "success": False,
            "message": "Room not found."
        }), 404

    return jsonify({"success": True, "members": members})


# -------------------------------------------------
# SEND MESSAGE
# -------------------------------------------------

@app.route("/message", methods=["POST"])
def message():
    try:
        data = request.get_json()

        username = data.get("username", "").strip()
        user_message = data.get("message", "").strip()
        room_id = data.get("room_id", "").strip().upper()

        if not username:
            return jsonify({
                "success": False,
                "message": "Username is required."
            }), 400

        if not user_message:
            return jsonify({
                "success": False,
                "message": "Message cannot be empty."
            }), 400

        if room_id:
            room = get_room(room_id)

            if not room or username not in room["members"]:
                return jsonify({
                    "success": False,
                    "message": "Join the room before sending messages."
                }), 403

            saved_user_message = save_room_message(
                room_id,
                username,
                user_message,
                "user"
            )

            room_history = get_room_conversation(room_id)
            ai_response = get_bot_response(
                user_message,
                room_history[:-1]
            )
            saved_ai_message = save_room_message(
                room_id,
                "AI Assistant",
                ai_response or "Sorry, I couldn't generate a response.",
                "ai"
            )

            return jsonify({
                "success": True,
                "user_message": saved_user_message,
                "ai_message": saved_ai_message
            })

        # Add user to group
        add_member(username)

        # -------------------------------------------------
        # SAVE USER MESSAGE
        # -------------------------------------------------

        saved_user_message = save_message(
            username,
            user_message,
            "user"
        )

        # -------------------------------------------------
        # GENERATE AI RESPONSE
        # -------------------------------------------------

        try:
            ai_response = get_bot_response(user_message)

            if not ai_response:
                ai_response = "Sorry, I couldn't generate a response."

        except Exception as ai_error:
            print("AI ERROR:", ai_error)

            ai_response = "Sorry, I couldn't generate a response."

        # -------------------------------------------------
        # SAVE AI MESSAGE TO SAME GROUP CHAT
        # -------------------------------------------------

        saved_ai_message = save_message(
            "AI Assistant",
            ai_response,
            "ai"
        )

        return jsonify({
            "success": True,
            "user_message": saved_user_message,
            "ai_message": saved_ai_message
        })

    except Exception as e:
        print("MESSAGE ERROR:", e)

        return jsonify({
            "success": False,
            "message": "Unable to send message."
        }), 500


# -------------------------------------------------
# FEEDBACK
# -------------------------------------------------

@app.route("/feedback", methods=["POST"])
def feedback():
    try:
        data = request.get_json()

        username = data.get("username", "Unknown")
        feedback_text = data.get("feedback", "").strip()

        if not feedback_text:
            return jsonify({
                "success": False,
                "message": "Feedback cannot be empty."
            }), 400

        save_feedback(username, feedback_text)

        return jsonify({
            "success": True,
            "message": "Feedback saved."
        })

    except Exception as e:
        print("FEEDBACK ERROR:", e)

        return jsonify({
            "success": False,
            "message": "Unable to save feedback."
        }), 500


# -------------------------------------------------
# RUN SERVER
# -------------------------------------------------

if __name__ == "__main__":
    print("")
    print("======================================")
    print("       AI MULTI-CHAT SERVER")
    print("======================================")
    print("Server: http://127.0.0.1:5000")
    print("Shared group chat: ENABLED")
    print("Multiple users: ENABLED")
    print("AI Assistant: ENABLED")
    print("======================================")
    print("")

    
app.run(
    host="0.0.0.0",
    port=int(os.environ.get("PORT", 5000)),
    debug=False
)