import socketio

# Create a Socket.IO client
sio = socketio.Client()

@sio.event
def connect():
    print("Successfully connected to CallSphere Signaling Server!")
    # Try to register a UID (Replace with the UID you got from the curl command)
    sio.emit('register-id', {'uid': '4839201745'})

@sio.on('registration-success')
def on_success(data):
    print("Server confirmed: You are now ONLINE for calls.")
    sio.disconnect()

sio.connect('http://127.0.0.1:5000')
sio.wait()