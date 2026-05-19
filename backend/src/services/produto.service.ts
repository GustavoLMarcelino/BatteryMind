import { produtos } from "../data/produtos.data.js";
import { CategoriaVeiculo, CreateProdutoDTO, Produto, UpdateProdutoDTO } from "../types/produto.types.js";
import { AppError } from "../utils/errors.js";
import { isVehicleCompatible } from "../utils/vehicleCompatibility.js";

export class ProdutoService {
  listar(): Produto[] {
    return produtos;
  }

  buscarPorId(id: number): Produto {
    const produto = produtos.find((item) => item.id === id);

    if (!produto) {
      throw new AppError("Produto não encontrado", 404);
    }

    return produto;
  }

  criar(dados: CreateProdutoDTO): Produto {
    this.validarProduto(dados);

    const novoProduto: Produto = {
      id: this.gerarProximoId(),
      ...dados
    };

    produtos.push(novoProduto);
    return novoProduto;
  }

  atualizar(id: number, dados: UpdateProdutoDTO): Produto {
    const produto = this.buscarPorId(id);
    const produtoAtualizado = { ...produto, ...dados };

    this.validarProduto(produtoAtualizado);

    const index = produtos.findIndex((item) => item.id === id);
    produtos[index] = produtoAtualizado;

    return produtoAtualizado;
  }

  remover(id: number): void {
    const index = produtos.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new AppError("Produto não encontrado", 404);
    }

    produtos.splice(index, 1);
  }

  listarCompativeis(veiculo: string): Produto[] {
    return produtos.filter((produto) => isVehicleCompatible(veiculo, produto.aplicacoesVeiculos));
  }

  listarCompativeisPorCategoria(veiculo: string, categoriaVeiculo: CategoriaVeiculo): Produto[] {
    return produtos.filter(
      (produto) =>
        produto.categoriaVeiculo === categoriaVeiculo &&
        isVehicleCompatible(veiculo, produto.aplicacoesVeiculos)
    );
  }

  private gerarProximoId(): number {
    return Math.max(...produtos.map((produto) => produto.id), 0) + 1;
  }

  private validarProduto(produto: CreateProdutoDTO): void {
    if (!produto.nome || !produto.marca || !produto.modelo) {
      throw new AppError("Nome, marca e modelo são obrigatórios");
    }

    if (produto.amperagem <= 0 || produto.precoVenda <= 0 || produto.custo < 0) {
      throw new AppError("Amperagem, preço de venda e custo devem ser valores válidos");
    }

    if (produto.quantidadeEstoque < 0 || produto.garantiaMeses < 0) {
      throw new AppError("Estoque e garantia não podem ser negativos");
    }

    if (!Array.isArray(produto.aplicacoesVeiculos) || produto.aplicacoesVeiculos.length === 0) {
      throw new AppError("Informe pelo menos uma aplicação de veículo");
    }
  }
}

export const produtoService = new ProdutoService();
