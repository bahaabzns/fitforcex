const express = require('express');
const cors = require('cors');

const server = express();

const PORT = 4000;

const pool = require('./db');

const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const cookieParser = require('cookie-parser');



server.use(cors({origin: 'http://localhost:3000', credentials: true}));
server.use(express.json());
server.use(cookieParser());
server.use('/api/auth', authRouter);
server.use('/api/dashboard', dashboardRouter);
server.use('/api/clients', require('./routes/clients'));

const nutritionRouter = require('./routes/nutrition');
server.use('/api/nutrition', nutritionRouter);
const trainingRouter = require('./routes/training');
server.use('/api/training', trainingRouter);

server.use('/api/client-portal', require('./routes/clientPortal'));
server.use('/api/forms', require('./routes/forms'));

server.get('/api/health', (req, res) => {
    res.status(200).json({message: 'All is good!'})
});

server.get('/api/db-test', async (req, res) => {
    try {
        await pool.query('SELECT NOW()')
        res.status(200).json({message: 'Database connection successful'})

    } catch(err) {
        res.status(500).json({message: 'Database connection failed'})
        console.log(err)
    }

})




server.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
})