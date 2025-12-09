import { Router } from 'express';
import { UsersController } from '../controllers/UsersController';
import { authMiddleware } from '../middlewares/Auth';
import { getCurrentUser } from '../controllers/GetCurrentUser'

const usersRoutes = Router();

usersRoutes.post(
  '/check-email',
  new UsersController().checkEmail
);

usersRoutes.post(
  '/',
  new UsersController().create
);

usersRoutes.post(
  '/login',
  new UsersController().login
);

usersRoutes.get(
  '/me',
  authMiddleware,
  getCurrentUser
);

usersRoutes.get(
  '/',
  authMiddleware,
  new UsersController().profile
);

export default usersRoutes;