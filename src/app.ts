import '#db';
import cors from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRoutes } from '#routes';
import { errorHandler, notFoundHandler } from '#middleware';
import { CLIENT_BASE_URL, PORT } from '#config';

const app = express();

app.use(
  cors({
    origin: CLIENT_BASE_URL,
    credentials: true,
    exposedHeaders: ['WWW-Authenticate'] // needed to send the 'refresh trigger''
  })
);

app.use(express.json(), cookieParser());

app.use('/auth', authRoutes);

app.use('*splat', notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Auth Server listening on http://localhost:${PORT}`);
});
