module.exports = function registerChatSocket(io, socket) {

    // Real-time private message sender event
    socket.on('send_message', async (payload, callback) => {
        const { conversationId, text, recipientId, fileUrl, fileType, fileName } = payload;

        if (!conversationId || !recipientId || (!text && !fileUrl)) {
            if (callback) callback({ success: false, error: 'Missing required payload fields.' });
            return;
        }

        try {
            const Message = require('../src/models/message.model');
            const Conversation = require('../src/models/conversation.model');

            // Store new message in DB
            const newMessage = await Message.create({
                conversationId,
                sender: socket.user.id,
                text: text || '',
                fileUrl: fileUrl || null,
                fileType: fileType || null,
                fileName: fileName || null
            });

            // Update conversation lastMessage reference and updatedAt timestamp
            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: newMessage._id
            });

            // Emit message to recipient's private room
            io.to(recipientId).emit('receive_message', newMessage);

            // Acknowledge back to sender via callback
            if (callback) {
                callback({
                    success: true,
                    data: newMessage
                });
            }
        } catch (err) {
            console.error('Error saving socket message:', err);
            if (callback) callback({ success: false, error: 'Internal server error saving message.' });
        }
    });

    // Relays dynamic typing indicator statuses in real-time
    socket.on('typing', ({ conversationId, recipientId, isTyping }) => {
        io.to(recipientId).emit('typing_status', {
            conversationId,
            senderId: socket.user.id,
            isTyping
        });
    });

    // Handle read receipt updates in real-time
    socket.on('mark_as_read', async ({ conversationId, senderId }) => {
        if (!conversationId || !senderId) return;

        try {
            const Message = require('../src/models/message.model');
            await Message.updateMany(
                { conversationId, sender: senderId, isRead: false },
                { $set: { isRead: true } }
            );

            // Notify original sender that their messages have been read
            io.to(senderId).emit('messages_read', {
                conversationId,
                readerId: socket.user.id
            });
        } catch (err) {
            console.error('Error updating read status:', err);
        }
    });
};