import * as express from 'express'

declare global {
    namespace Express {
        interface Request {
            user: {
                id: string
                email: string
            }
        }
    }
}

// custom.d.ts
// declare module 'multer-storage-cloudinary';