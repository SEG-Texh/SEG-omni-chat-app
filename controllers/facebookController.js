const Message = require('../models/message');
const { getIO } = require('../config/socket');
const User = require('../models/User');

const facebookController = {
    /**
     * Verify Facebook Webhook
     * This is used during the webhook setup process
     */
    verifyFacebookWebhook: (req, res) => {
        const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
        
        if (!VERIFY_TOKEN) {
            console.error('Facebook verify token not configured');
            return res.sendStatus(500);
        }
        
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('Facebook webhook verified');
                return res.status(200).send(challenge);
            }
            console.warn('Failed verification - token mismatch');
            return res.sendStatus(403);
        }
        return res.sendStatus(400);
    },

    /**
     * Handle incoming messages and events from Facebook
     */
    handleFacebookWebhook: async (req, res) => {
        try {
            if (req.body.object !== 'page') {
                return res.status(400).send('Invalid object type');
            }

            const io = getIO();
            const processingPromises = [];

            // Process each entry (batched events)
            for (const entry of req.body.entry) {
                // Process each messaging event
                for (const event of entry.messaging) {
                    try {
                        if (event.message && !event.message.is_echo) {
                            // Handle message events
                            processingPromises.push(
                                this.processMessageEvent(event, entry.id, io)
                            );
                        } else if (event.postback) {
                            // Handle postback events
                            processingPromises.push(
                                this.processPostbackEvent(event, io)
                            );
                        } else if (event.delivery) {
                            // Handle delivery confirmations
                            processingPromises.push(
                                this.processDeliveryEvent(event)
                            );
                        } else if (event.read) {
                            // Handle read receipts
                            processingPromises.push(
                                this.processReadEvent(event)
                            );
                        }
                    } catch (error) {
                        console.error('Error processing individual event:', error);
                    }
                }
            }

            // Wait for all processing to complete
            await Promise.all(processingPromises);
            return res.status(200).send('EVENT_RECEIVED');
            
        } catch (error) {
            console.error('Error in Facebook webhook handler:', error);
            return res.status(500).send('SERVER_ERROR');
        }
    },

    /**
     * Process incoming message event
     */
    processMessageEvent: async (event, pageId, io) => {
        try {
            const senderId = event.sender.id;
            const message = event.message;
            
            // Check if message exists to prevent duplicates
            const existingMessage = await Message.findOne({
                platform: 'facebook',
                platformMessageId: message.mid
            });
            
            if (existingMessage) {
                console.log('Duplicate message detected, skipping');
                return;
            }

            // Create and save the message
            const newMessage = await Message.create({
                platform: 'facebook',
                platformMessageId: message.mid,
                platformThreadId: senderId,
                direction: 'inbound',
                status: 'delivered',
                content: {
                    text: message.text,
                    attachments: message.attachments?.map(attach => ({
                        type: attach.type,
                        url: attach.payload?.url,
                        caption: attach.title,
                        mimeType: attach.payload?.mime_type,
                        size: attach.payload?.size,
                        coordinates: attach.payload?.coordinates
                    })),
                    quickReplies: message.quick_reply?.payload ? 
                        [message.quick_reply.payload] : undefined
                },
                sender: {
                    id: senderId,
                    platform: 'facebook'
                },
                recipient: {
                    id: pageId,
                    platform: 'facebook'
                },
                labels: ['unclaimed'],
                metadata: {
                    isForwarded: message.is_forwarded,
                    isReply: message.reply_to?.mid ? true : false,
                    originalMessageId: message.reply_to?.mid,
                    facebookMessageTag: event.message_tag
                }
            });

            // Emit socket event
            io.emit('new_message', {
                event: 'facebook_message',
                message: newMessage
            });

            // Check if this is a reply to an existing message
            if (message.reply_to?.mid) {
                await Message.updateOne(
                    { platformMessageId: message.reply_to.mid },
                    { $push: { labels: 'replied' } }
                );
            }

            console.log('Processed new Facebook message:', newMessage.id);
            return newMessage;

        } catch (error) {
            console.error('Error processing message event:', error);
            throw error;
        }
    },

    /**
     * Process postback events (button clicks, etc.)
     */
    processPostbackEvent: async (event, io) => {
        try {
            const senderId = event.sender.id;
            const payload = event.postback.payload;
            
            // Create a message record for the postback
            const postbackMessage = await Message.create({
                platform: 'facebook',
                platformMessageId: `pb-${Date.now()}-${senderId}`,
                platformThreadId: senderId,
                direction: 'inbound',
                status: 'delivered',
                content: {
                    text: `[POSTBACK] ${payload}`,
                    buttons: [{
                        type: 'postback',
                        title: event.postback.title || 'Button',
                        payload: payload
                    }]
                },
                sender: {
                    id: senderId,
                    platform: 'facebook'
                },
                recipient: {
                    id: event.recipient.id,
                    platform: 'facebook'
                },
                labels: ['unclaimed', 'postback'],
                metadata: {
                    postback: event.postback
                }
            });

            io.emit('new_message', {
                event: 'facebook_postback',
                message: postbackMessage
            });

            console.log('Processed Facebook postback:', postbackMessage.id);
            return postbackMessage;

        } catch (error) {
            console.error('Error processing postback event:', error);
            throw error;
        }
    },

    /**
     * Process message delivery confirmations
     */
    processDeliveryEvent: async (event) => {
        try {
            const mids = event.delivery.mids || [];
            const watermark = event.delivery.watermark;
            
            // Update status for all delivered messages
            const result = await Message.updateMany(
                {
                    platform: 'facebook',
                    platformMessageId: { $in: mids },
                    direction: 'outbound'
                },
                {
                    $set: { status: 'delivered' },
                    $push: { 
                        statusHistory: {
                            status: 'delivered',
                            timestamp: new Date(watermark)
                        } 
                    }
                }
            );

            console.log(`Updated ${result.nModified} messages to delivered status`);
            return result;

        } catch (error) {
            console.error('Error processing delivery event:', error);
            throw error;
        }
    },

    /**
     * Process message read receipts
     */
    processReadEvent: async (event) => {
        try {
            const watermark = event.read.watermark;
            const senderId = event.sender.id;
            
            // Update all messages before the watermark to 'read'
            const result = await Message.updateMany(
                {
                    platform: 'facebook',
                    'sender.id': senderId,
                    direction: 'outbound',
                    status: { $ne: 'read' },
                    timestamp: { $lte: new Date(watermark) }
                },
                {
                    $set: { status: 'read' },
                    $push: { 
                        statusHistory: {
                            status: 'read',
                            timestamp: new Date(watermark)
                        } 
                    }
                }
            );

            console.log(`Updated ${result.nModified} messages to read status`);
            return result;

        } catch (error) {
            console.error('Error processing read event:', error);
            throw error;
        }
    },

    /**
     * Send message to Facebook user
     */
    sendMessage: async (recipientId, messageContent, options = {}) => {
        try {
            // This would actually call Facebook's API to send the message
            // For now, we'll simulate and store the outbound message
            
            const message = await Message.create({
                platform: 'facebook',
                platformMessageId: `temp-${Date.now()}-${recipientId}`,
                platformThreadId: recipientId,
                direction: 'outbound',
                status: 'sent',
                content: messageContent,
                sender: {
                    id: options.pageId || process.env.FACEBOOK_PAGE_ID,
                    platform: 'facebook'
                },
                recipient: {
                    id: recipientId,
                    platform: 'facebook'
                },
                metadata: {
                    ...options.metadata,
                    isOutbound: true
                }
            });

            // In a real implementation, you would:
            // 1. Call Facebook API to send the message
            // 2. Update the message with the real platformMessageId from the API response
            // 3. Update status based on API response

            console.log('Sent Facebook message to:', recipientId);
            return message;

        } catch (error) {
            console.error('Error sending Facebook message:', error);
            throw error;
        }
    }
};

module.exports = facebookController;