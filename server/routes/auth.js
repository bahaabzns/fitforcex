const express = require('express');

const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const jwt = require('jsonwebtoken');


router.get('/test', (req, res) => {
    res.status(200).json({message: 'Auth route is working!'});
})



router.post('/register', async (req, res) => {
    try {
        const { fname, lname, email, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);

        const result = await pool.query(
            'INSERT INTO users (fname, lname, email, password) VALUES ($1, $2, $3, $4) RETURNING id, fname, lname, email',
            [fname, lname, email, hashed]
        )

        console.log('Registration successful:', result.rows[0]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.log(err);
        res.status(500).json({message: 'Registration failed'});
    }
    
});




router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        )

        if (result.rows.length === 0 ) {
            return res.status(401).json({message: 'Invalid email or password'});
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({message: 'Invalid email or password'});
        }

        const token = jwt.sign({
            id: user.id,
        }, process.env.JWT_SECRET, {expiresIn: '1h'});

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7*24*60*60*1000, // 7 days
        }).status(200).json({message: 'Login successful', token});


    } catch (err) {
        console.log(err);
        res.status(500).json({message: 'Login failed'});
    }
});


router.get('/me', async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({message: 'Not authenticated'});
    }

    try {

        const decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await pool.query('SELECT id, fname, lname, email FROM users WHERE id = $1', 
            [decode.id]
        )

        if (user.rows.length === 0) {
            return res.status(404).json({message: 'User not found'});
        }

        res.status(200).json(user.rows[0]);

    } catch (err) {
        console.log(err);
        res.status(401).json({message: 'Expired or invalid token'});
    }
});


router.post('/logout', (req, res) => {
    res.clearCookie('token').status(200).json({message: 'Logged out successfully'});
});


module.exports = router;
