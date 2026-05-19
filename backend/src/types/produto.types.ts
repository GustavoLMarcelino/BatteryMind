export type ProdutoTipo = "economica" | "intermediaria" | "premium";
export type CategoriaVeiculo = "carro" | "moto" | "caminhao";

export interface Produto {
  id: number;
  nome: string;
  marca: string;
  amperagem: number;
  modelo: string;
  precoVenda: number;
  custo: number;
  quantidadeEstoque: number;
  garantiaMeses: number;
  aplicacoesVeiculos: string[];
  tipo: ProdutoTipo;
  categoriaVeiculo: CategoriaVeiculo;
}

export type CreateProdutoDTO = Omit<Produto, "id">;
export type UpdateProdutoDTO = Partial<CreateProdutoDTO>;
