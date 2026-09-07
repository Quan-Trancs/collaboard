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
    background: Joi.object({
      color: Joi.string().optional(),
      image: Joi.string().allow(null, '').optional(),
    }).optional(),
    viewport: Joi.object({
      x: Joi.number().optional(),
      y: Joi.number().optional(),
      zoom: Joi.number().min(0.1).max(4).optional(),
    }).optional(),
  }),

  addCollaborator: Joi.object({
    email: Joi.string().email().required(),
    permission: Joi.string().valid('view', 'edit', 'admin').default('view'),
  }),

  updateCollaborator: Joi.object({
    permission: Joi.string().valid('view', 'edit', 'admin').required(),
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

  createSlideObject: Joi.object({
    board_id: Joi.string().required(),
    type: Joi.string().valid('text', 'shape', 'image', 'table', 'chart', 'icon').required(),
    transform: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required(),
      width: Joi.number().required(),
      height: Joi.number().required(),
      rotation: Joi.number().optional(),
    }).required(),
    zIndex: Joi.number().optional(),
    locked: Joi.boolean().optional(),
    visible: Joi.boolean().optional(),
    props: Joi.object().optional(),
  }),

  updateSlideObject: Joi.object({
    transform: Joi.object({
      x: Joi.number().optional(),
      y: Joi.number().optional(),
      width: Joi.number().optional(),
      height: Joi.number().optional(),
      rotation: Joi.number().optional(),
    }).optional(),
    zIndex: Joi.number().optional(),
    locked: Joi.boolean().optional(),
    visible: Joi.boolean().optional(),
    props: Joi.object().optional(),
  }),

  createInkStroke: Joi.object({
    board_id: Joi.string().required(),
    points: Joi.array().items(
      Joi.object({
        x: Joi.number().required(),
        y: Joi.number().required(),
      })
    ).min(2).required(),
    color: Joi.string().required(),
    strokeWidth: Joi.number().min(1).required(),
  }),

  updateInkStroke: Joi.object({
    points: Joi.array().items(
      Joi.object({
        x: Joi.number().required(),
        y: Joi.number().required(),
      })
    ).min(2).optional(),
    color: Joi.string().optional(),
    strokeWidth: Joi.number().min(1).optional(),
  }),

  batchSaveDrawings: Joi.object({
    boardId: Joi.string().required(),
    strokes: Joi.array().items(
      Joi.object({
        id: Joi.string().optional(),
        points: Joi.array().items(
          Joi.object({
            x: Joi.number().required(),
            y: Joi.number().required(),
          })
        ).min(2).required(),
        color: Joi.string().required(),
        strokeWidth: Joi.number().min(1).required(),
      })
    ).min(1).max(200).required(),
  }),
};

