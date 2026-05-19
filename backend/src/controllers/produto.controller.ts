import { Request, Response } from "express";
import { produtoService } from "../services/produto.service.js";
import { CreateProdutoDTO, UpdateProdutoDTO } from "../types/produto.types.js";
import { successResponse } from "../utils/response.js";

export class ProdutoController {
  listar(_request: Request, response: Response): Response {
    return successResponse(response, "Produtos listados com sucesso", produtoService.listar());
  }

  buscarPorId(request: Request, response: Response): Response {
    const produto = produtoService.buscarPorId(Number(request.params.id));
    return successResponse(response, "Produto encontrado com sucesso", produto);
  }

  criar(request: Request<object, object, CreateProdutoDTO>, response: Response): Response {
    const produto = produtoService.criar(request.body);
    return successResponse(response, "Produto cadastrado com sucesso", produto, 201);
  }

  atualizar(
    request: Request<{ id: string }, object, UpdateProdutoDTO>,
    response: Response
  ): Response {
    const produto = produtoService.atualizar(Number(request.params.id), request.body);
    return successResponse(response, "Produto atualizado com sucesso", produto);
  }

  remover(request: Request, response: Response): Response {
    produtoService.remover(Number(request.params.id));
    return successResponse(response, "Produto removido com sucesso");
  }
}

export const produtoController = new ProdutoController();
