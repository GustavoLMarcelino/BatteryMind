import { Response } from "express";

export function successResponse<T>(
  response: Response,
  message: string,
  data?: T,
  statusCode = 200
): Response {
  return response.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined ? { data } : {})
  });
}

export function errorResponse(response: Response, message: string, statusCode = 500): Response {
  return response.status(statusCode).json({
    success: false,
    message
  });
}
