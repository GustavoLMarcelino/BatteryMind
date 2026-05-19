import { ErrorRequestHandler } from "express";
import { AppError } from "../utils/errors.js";
import { errorResponse } from "../utils/response.js";

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    return errorResponse(response, error.message, error.statusCode);
  }

  console.error(error);
  return errorResponse(response, "Erro interno do servidor", 500);
};
