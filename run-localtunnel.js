const lt = require('localtunnel');

// Create a tunnel to your local server
lt({ port: 3000 }, (err, tunnel) => {
  if (err) {
    console.error('Error creating tunnel:', err);
    return;
  }
  
  console.log('Localtunnel URL:', tunnel.url);
  // Keep the tunnel running
});
