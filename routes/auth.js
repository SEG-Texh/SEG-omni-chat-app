// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path to your User model
const router = express.Router();

// Frontend login function - fix this in your client-side code
const handleLogin = async (email, password) => {
  try {
    const response = await fetch('/api/auth/login', { // Make sure this matches your route
      method: 'POST', // Use POST, not GET
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ // Send as JSON body, not query params
        email,
        password
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      // Store the token
      localStorage.setItem('token', data.token);
      // Handle successful login
      console.log('Login successful:', data);
    } else {
      // Handle error
      console.error('Login failed:', data.message);
    }
  } catch (error) {
    console.error('Login error:', error);
  }
};

// Alternative using axios if you prefer
const handleLoginWithAxios = async (email, password) => {
  try {
    const response = await axios.post('/api/auth/login', {
      email,
      password
    });
    
    // Store the token
    localStorage.setItem('token', response.data.token);
    console.log('Login successful:', response.data);
  } catch (error) {
    console.error('Login failed:', error.response?.data?.message || error.message);
  }
};

// If you're using a form, make sure to prevent default submission
const handleFormSubmit = (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const email = formData.get('email');
  const password = formData.get('password');
  handleLogin(email, password);
};