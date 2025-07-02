# Omni Chat App

A real-time chat application with Facebook Messenger integration.

## Deployment to Render.com

1. Create a Render account at https://render.com
2. Connect your GitHub repository
3. Create a new Web Service:
   - Name: omni-chat-app
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables:
     - JWT_SECRET: your_jwt_secret_here
     - MONGODB_URI: your_mongodb_uri_here
     - FACEBOOK_VERIFY_TOKEN: your_facebook_verify_token_here
     - PORT: 3000
4. After deployment, configure Facebook webhook:
   - Callback URL: `https://your-render-url/api/facebook/webhook`
   - Verify Token: `my-free-app-1234`
   - Subscription Fields: messages

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with:
   ```
   JWT_SECRET=your_jwt_secret_here
   MONGODB_URI=your_mongodb_uri_here
   FACEBOOK_VERIFY_TOKEN=your_facebook_verify_token_here
   PORT=3000
   ```

3. Run the server:
   ```bash
   npm start
   ```

4. Access the app at: http://localhost:3000
