import { Request, Response } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Joi from 'joi'

const normalizeDocument = (doc: string) => (doc || '').replace(/\D/g, '');
const isValidDocument = (doc: string) => {
    const digits = normalizeDocument(doc);
    // CNPJ (Brasil) -> 14 digits, EIN (US) -> 9 digits
    return digits.length === 14 || digits.length === 9;
};

const BCRYPT_SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = '1h'; 
const JWT_SECRET = process.env.SECRET_KEY || '';

const checkEmailSchema = Joi.object({
    email: Joi.string().email().required(),
});

const createUserSchema = Joi.object({
    companyName: Joi.string().min(1).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({
        'any.only': 'confirmPassword must match password',
    }),
    document: Joi.string().required(), // further validated below
    companyWebsite: Joi.string().uri().optional().allow('', null),
    name: Joi.string().optional().allow('', null),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});


export class UsersController {
    async checkEmail(req: Request, res: Response) {
        const { error, value } = checkEmailSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: 'Invalid email', details: error.message });
            return
        }

        try {
            const user = await prisma.user.findUnique({
                where: {
                    email: value.email
                }
            })

            if (user) {
                res.status(409).json({ message: "This email is already in use" })
                return
            }

            res.status(200).json({ message: "Email is available" })
        } catch (error: any) {
            console.error('[CHECK EMAIL]', error);
            res.status(500).json({ message: "Erro interno no servidor", error: error.message });
        }
    }
    async create(req: Request, res: Response) {
        const { error, value } = createUserSchema.validate(req.body, { stripUnknown: true });
        if (error) {
            res.status(400).json({ message: 'Validation error', details: error.message });
            return
        }

        const { name, email, password, document: rawDocument, companyName, companyWebsite } = value
        const document = normalizeDocument(rawDocument);

        if (!isValidDocument(document)) {
            res.status(400).json({ message: "Invalid document format" });
            return
        }

        try {
            const existing = await prisma.user.findFirst({
                where: {
                    OR: [{ email }, { document }],
                },
                select: { id: true, email: true, document: true },
            });

            if (existing) {
                if (existing.email === email) {
                    res.status(409).json({ message: 'Email already in use' });
                    return
                }
                if (existing.document === document) {
                    res.status(409).json({ message: 'Document already in use' });
                    return
                }

                res.status(409).json({ message: 'User already exists' });
                return
            }

            const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)

            const newUser = await prisma.user.create({
                data: {
                    name: name || null,
                    email,
                    document,
                    companyName,
                    companyWebsite: companyWebsite || null,
                    passwordHash: hashedPassword
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    companyName: true,
                    companyWebsite: true,
                    document: true,
                    createdAt: true,
                },
            })

            // gerar verificação por email aqui

            res.status(201).json({ newUser, message: "User created successfully" })
        } catch (error: any) {
            console.error(error)

            if (error?.code === 'P2002' && Array.isArray(error?.meta?.target)) {
                const target = error.meta.target.join(', ');
                res.status(409).json({ message: `Unique constraint failed on fields: ${target}` });
            }

            res.status(500).json({ message: "Internal Server Error", error: error.message })
        }
    }

    async login(req: Request, res: Response) {
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: 'Validation error', details: error.message });
            return
        }

        const { email, password } = value;

        try {
            const user = await prisma.user.findUnique({
                where: {
                    email
                },
                select: { id: true, passwordHash: true, email: true, name: true },
            })

            if (!user || !user.passwordHash) {
                res.status(401).json({ message: 'Invalid credentials' });
                return
            }

            const passwordMatches = await bcrypt.compare(password, user.passwordHash);
            if (!passwordMatches) {
                res.status(401).json({ message: 'Invalid credentials' });
                return
            }

            if (!JWT_SECRET) {
                console.error('JWT secret is not set');
                res.status(500).json({ message: 'Authentication server misconfigured' });
                return
            }

            // const secretKey = process.env.SECRET_KEY

            // if (!secretKey) {
            //     throw new Error('SECRET_KEY is not defined in the environment variables')
            // }

            // if (user && bcrypt.compareSync(password, user.passwordHash)) {
            //     const token = jwt.sign({ id: user.id }, secretKey, { expiresIn: '1h' })
            //     response.json({ token })
            //     return
            // }

            const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

            res.json({ token, expiresIn: JWT_EXPIRES_IN });
        } catch (error) {
            console.error(error)
            res.status(500).send({ message: "Internal server error" })
        }
    }

    // async profile(req: Request, res: Response) {
    //     res.json(req.user)
    // }

    async profile(req: Request, res: Response) {
    try {
      const userId = req.user.id;

      if (!userId) {
        res.status(401).json({ message: 'Not authenticated' });
        return
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          companyName: true,
          companyWebsite: true,
          document: true,
          avatarUrl: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) { 
        res.status(404).json({ message: 'User not found' });
      }

      res.json({ user });
    } catch (err) {
      console.error('[PROFILE]', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}