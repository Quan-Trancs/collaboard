/**
 * Input validation middleware using Joi
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Replace req.body with validated and sanitized value
    req.body = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(1).max(100).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    avatar_url: Joi.string().uri().allow(null, '').optional(),
  }),

  createBoard: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(1000).allow('').optional(),
    is_public: Joi.boolean().optional(),
  }),

  updateBoard: Joi.object({
    title: Joi.string().min(1).max(200).optional(),
    description: Joi.string().max(1000).allow('').optional(),
    is_public: Joi.boolean().optional(),
  }),

  addCollaborator: Joi.object({
    email: Joi.string().email().required(),
    permission: Joi.string().valid('view', 'edit', 'admin').default('view'),
  }),

  createElement: Joi.object({
    board_id: Joi.string().required(),
    type: Joi.string().valid('drawing', 'text', 'shape', 'image', 'table', 'chart', 'icon').required(),
    data: Joi.object().required(),
    position: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
    }).required(),
    size: Joi.object({
      width: Joi.number().optional(),
      height: Joi.number().optional(),
    }).optional(),
  }),

  batchSaveElements: Joi.object({
    boardId: Joi.string().required(),
    elements: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        type: Joi.string().valid('drawing', 'text', 'shape', 'image', 'table', 'chart', 'icon').required(),
        data: Joi.object().required(),
        position: Joi.object({
          x: Joi.number().required(),
          y: Joi.number().required(),
        }).required(),
        size: Joi.object({
          width: Joi.number().optional(),
          height: Joi.number().optional(),
        }).optional(),
      })
    ).min(1).max(100).required(),
  }),
};

