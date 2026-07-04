import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cart.js';

dotenv.config();

const app = express();

// (Removed raw-body logger that consumed request stream.)

const parseJsonBody = (req, res, next) => {
    if (req.body === undefined || req.body === null) {
        req.body = {};
        return next();
    }

    if (Buffer.isBuffer(req.body)) {
        const raw = req.body.toString('utf8').trim();
        if (!raw) {
            req.body = {};
            return next();
        }

        const candidates = [raw];
        if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
            candidates.push(raw.slice(1, -1));
        }

        let lastError;
        for (const candidate of candidates) {
            try {
                req.body = JSON.parse(candidate);
                return next();
            } catch (error) {
                lastError = error;
            }
        }

        return res.status(400).json({
            message: 'Invalid JSON payload',
            error: lastError?.message || 'Could not parse request body',
        });
    }

    if (typeof req.body === 'string') {
        const trimmed = req.body.trim();
        if (!trimmed) {
            req.body = {};
            return next();
        }

        try {
            req.body = JSON.parse(trimmed);
            return next();
        } catch (error) {
            return res.status(400).json({
                message: 'Invalid JSON payload',
                error: error.message,
            });
        }
    }

    if (typeof req.body === 'object' && !Array.isArray(req.body)) {
        return next();
    }

    next();
};

app.use(cors());
app.use(express.raw({ type: ['application/json', 'text/plain', 'application/*+json'], limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(parseJsonBody);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);


app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && err.type === 'entity.parse.failed') {
        return res.status(400).json({
            message: 'Invalid JSON payload',
            error: err.message,
        });
    }
    next(err);
});

// simple request logger to debug routing
app.use((req, res, next) => {
    console.log('Incoming request:', req.method, req.path);
    next();
});

app.use('/api/auth', authRoutes);

// Print registered routes for debugging
if (app._router) {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            // routes registered directly on the app
            const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
            routes.push(`${methods} ${middleware.route.path}`);
        } else if (middleware.name === 'router' && middleware.handle && middleware.handle.stack) {
            // router middleware
            middleware.handle.stack.forEach((handler) => {
                if (handler.route) {
                    const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
                    routes.push(`${methods} ${middleware.regexp} -> ${handler.route.path}`);
                }
            });
        }
    });
    console.log('Registered routes:\n', routes.join('\n'));
}

app.get('/', (req, res) => {
    res.send('API is running...');
});

app.get('/routes', (req, res) => {
    const routes = [];
    if (app._router) {
        app._router.stack.forEach((middleware) => {
            if (middleware.route) {
                const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
                routes.push({ path: middleware.route.path, methods });
            }
        });
    }
    res.json({ routes });
});

connectDB();

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`)
})