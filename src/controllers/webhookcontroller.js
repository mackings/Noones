const nacl = require('tweetnacl');

// Signature validation function
const isValidSignature = (signature, host, originalUrl, rawBody, publicKey) => {
    const message = `https://${host}${originalUrl}:${rawBody}`;
    return nacl.sign.detached.verify(
        Buffer.from(message, 'utf8'),
        Buffer.from(signature, 'base64'),
        Buffer.from(publicKey, 'base64')
    );
};

const webhookHandler = async (req, res) => {
    const publicKey = 'fvcYFZlQl21obFbW5+RK2/foq8JzK/Y5fCEqg+NEy+k=';

    const challenge = req.headers['x-noones-request-challenge'];
    if (challenge) {
        res.set('x-noones-request-challenge', challenge);
        res.status(200).end();
        return;
    }

    const signature = req.get('x-noones-signature');
    if (!signature || !req.rawBody || req.rawBody.trim() === '') {
        res.status(400).json({ status: 'error', message: 'Invalid request' });
        return;
    }

    if (!isValidSignature(signature, req.get('host'), req.originalUrl, req.rawBody, publicKey)) {
        res.status(403).json({ status: 'error', message: 'Invalid signature' });
        return;
    }

    let parsedBody;

    try {
        parsedBody = JSON.parse(req.rawBody);
    } catch (err) {
        console.warn('Failed to parse webhook body as JSON:', req.rawBody);
        res.status(400).json({ status: 'error', message: 'Invalid JSON body' });
        return;
    }
    
    // Define your trade started and message handler functions
    const handleTradeStarted = (payload) => {
        console.log('Handling trade started event:', payload);
        // Call your specific function to process the trade start event
        // processTradeStart(payload);
    };
    
    const handleTradeMessage = (payload) => {
        console.log('Handling trade message event:', payload);
        // Check if the message contains bank account instruction or regular message
        if (payload.type === 'bank-account-instruction') {
            console.log('Bank account instruction received:', payload.text.bank_account);
            // Call your specific function to handle bank account instructions
            // handleBankAccountInstruction(payload);
        } else {
            console.log('Regular message received:', payload.text);
            // Call your specific function to handle regular messages
            // handleRegularMessage(payload);
        }
    };
    
    // Check the webhook type and call the respective handler function
    const webhookType = parsedBody?.type;
    
    if (webhookType === 'trade.started') {
        handleTradeStarted(parsedBody.payload);
    } else if (webhookType === 'trade.chat_message_received') {
        handleTradeMessage(parsedBody.payload);
    } else {
        console.debug('Unrecognized webhook type:', webhookType);
    }
    
    console.debug('Valid webhook received:', parsedBody);
    

    // Respond to the webhook
    res.status(200).send('Webhook received');
};

module.exports = { webhookHandler };
