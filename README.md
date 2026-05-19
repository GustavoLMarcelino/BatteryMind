# BatteryMind — Sistema Inteligente para Recomendação de Baterias Automotivas

## 1. Sobre o Projeto

O **BatteryMind** é um sistema inteligente desenvolvido para auxiliar uma loja de baterias automotivas no atendimento ao cliente, análise de mensagens e recomendação de produtos compatíveis.

A proposta foi criada para a disciplina de **Inteligência Artificial**, seguindo o enunciado da atividade **N2 — Sistema Inteligente**. O trabalho exige a construção de um sistema capaz de processar informações não estruturadas, tratar incertezas e otimizar uma tomada de decisão usando algoritmos de IA.

O sistema foi inspirado em um cenário real de uma loja de baterias, onde clientes normalmente entram em contato por mensagens informais, como:

> “Meu carro não liga e preciso resolver isso hoje.”

A partir desse tipo de entrada, o BatteryMind realiza uma triagem inteligente, identifica o contexto do atendimento e recomenda uma bateria ou serviço adequado, respeitando a compatibilidade com o veículo.

---

## 2. Objetivo

O objetivo do projeto é desenvolver um sistema inteligente dividido em três camadas principais:

1. **Camada I — Percepção e Sentimento com PLN e Naive Bayes**
2. **Camada II — Inferência e Tratamento de Incerteza com Lógica Fuzzy**
3. **Camada III — Otimização Estocástica com Algoritmo Genético**

Essa estrutura segue o documento do trabalho, que solicita obrigatoriamente o uso de PLN com Naive Bayes, Sistema de Inferência Fuzzy e uma meta-heurística para otimização da decisão final.

---

## 3. Problema Trabalhado

Em uma loja de baterias, o atendimento depende de várias informações:

- modelo do veículo;
- tipo do veículo: carro, moto ou caminhão;
- sintomas apresentados;
- orçamento do cliente;
- urgência do atendimento;
- estoque disponível;
- compatibilidade da bateria;
- margem de lucro;
- garantia do produto.

Muitas vezes o cliente não informa tudo de uma vez. Por exemplo:

> “Estou com um problema no meu carro.”

Essa frase indica que existe uma necessidade, mas ainda não informa o modelo do veículo nem o sintoma real. Por isso, o sistema precisa conversar com o cliente, pedir dados faltantes e evitar recomendações inseguras.

---

## 4. Solução Proposta

O BatteryMind funciona como um chatbot inteligente para atendimento inicial.

Ele recebe a mensagem do cliente, interpreta a intenção, guarda o contexto da conversa e decide se já possui informações suficientes para recomendar uma bateria.

Caso faltem dados importantes, ele faz perguntas específicas, como:

> “Qual é o modelo do veículo e o que está acontecendo?”

ou

> “Para recomendar a bateria correta da moto, preciso do modelo e cilindrada. Exemplo: CG 160, Biz 125, Fazer 250 ou XRE 300.”

Quando há dados suficientes, o sistema executa as três camadas de IA e retorna uma recomendação.

---

## 5. Arquitetura Geral

O projeto foi dividido em duas partes principais:

```txt
BatteryMind/
├── backend/
│   ├── src/
│   ├── dist/
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   └── requests.http
│
├── frontend/
│   ├── src/
│   ├── dist/
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
├── package.json
└── package-lock.json
```

O **frontend** foi desenvolvido com React e Vite.  
O **backend** foi desenvolvido com Node.js, Express e TypeScript.

---

## 6. Tecnologias Utilizadas

### Frontend

- React
- Vite
- JavaScript
- CSS
- Consumo de API REST

### Backend

- Node.js
- Express
- TypeScript
- CORS
- dotenv
- Arquitetura em camadas

### Inteligência Artificial

- PLN com Naive Bayes
- Sistema de Inferência Fuzzy
- Algoritmo Genético
- Triagem de sintomas
- Contexto conversacional em memória

---

## 7. Camadas de Inteligência Artificial

### 7.1 Camada I — PLN com Naive Bayes

A primeira camada recebe a mensagem do cliente e aplica técnicas simples de Processamento de Linguagem Natural.

O sistema realiza:

- normalização do texto;
- remoção de acentos;
- remoção de pontuação;
- tokenização;
- remoção de palavras irrelevantes;
- classificação de sentimento.

As mensagens são classificadas como:

- positivo;
- neutro;
- negativo.

Exemplo:

```txt
Mensagem:
"Meu carro não liga e preciso resolver isso hoje."

Resultado:
Sentimento: negativo
```

Essa camada é importante porque ajuda o sistema a entender o tom da mensagem. Um cliente com urgência ou insatisfação pode receber maior prioridade no atendimento.

---

### 7.2 Camada II — Sistema de Inferência Fuzzy

A segunda camada trata a incerteza.

Nem sempre uma mensagem deixa claro se o problema é realmente bateria. Por exemplo:

```txt
"Meu carro não liga."
```

Esse sintoma pode estar relacionado a bateria, mas também pode envolver:

- motor de arranque;
- alternador;
- mau contato;
- cabo solto;
- terminal oxidado;
- sistema elétrico.

Por isso, a lógica fuzzy combina variáveis como:

- sentimento negativo;
- urgência;
- tipo de sintoma;
- disponibilidade de estoque;
- margem de lucro;
- orçamento informado.

A saída é um score de prioridade, como:

```txt
Prioridade: alta
Score Fuzzy: 82/100
```

O sistema classifica a prioridade em:

- baixa;
- média;
- alta;
- urgente.

---

### 7.3 Camada III — Algoritmo Genético

A terceira camada usa um Algoritmo Genético para escolher a melhor recomendação entre os produtos compatíveis.

O algoritmo considera critérios como:

- compatibilidade com o veículo;
- categoria do veículo: carro, moto ou caminhão;
- estoque disponível;
- preço de venda;
- custo;
- margem de lucro;
- garantia;
- preferência do cliente;
- score fuzzy;
- orçamento máximo informado.

A recomendação só pode ser feita se a bateria for compatível com o veículo informado.

Exemplo:

```txt
Veículo: Onix 2020
Sintoma: não liga
Recomendação: Bateria Moura 60Ah
Serviços: Teste elétrico, teste de bateria e verificação dos terminais
```

---

## 8. Contexto Conversacional

O sistema também possui uma camada de contexto conversacional.

Isso permite que o chatbot lembre informações enviadas em mensagens anteriores.

Exemplo:

```txt
Cliente: Estou com problema no meu caminhão.
Bot: Qual é o modelo do caminhão e ele usa sistema 12V ou 24V?
Cliente: Ele é 24V.
Bot: Certo, sistema 24V. O que acontece com o caminhão?
```

Sem essa camada, o sistema trataria cada mensagem como uma conversa nova.

---

## 9. Triagem de Sintomas

O BatteryMind não assume automaticamente que todo problema é causado pela bateria.

Ele diferencia sintomas genéricos de sintomas mais fortes.

### Sintoma genérico

```txt
"Meu carro não liga."
```

Possíveis causas:

- bateria fraca;
- mau contato;
- motor de arranque;
- alternador;
- sistema elétrico.

Nesse caso, a recomendação é condicional e inclui teste elétrico.

### Forte indício de bateria

```txt
"Não acende nada."
"Painel pisca ao dar partida."
"Partida está fraca."
```

Esses sintomas aumentam a chance de o problema estar relacionado à bateria, mas o sistema ainda recomenda teste antes da troca.

### Problema recorrente

```txt
"A bateria vive descarregando."
```

Nesse caso, o sistema recomenda diagnóstico, pois pode haver fuga de corrente ou problema no alternador.

---

## 10. Regras de Segurança da Recomendação

O sistema possui algumas regras para evitar recomendações incorretas:

- não recomenda bateria se o veículo não for identificado;
- não recomenda bateria de carro para moto;
- não recomenda bateria de carro para caminhão;
- não recomenda bateria de moto sem modelo/cilindrada;
- não recomenda bateria de caminhão sem informação de tensão 12V ou 24V;
- não recomenda produto sem estoque;
- não recomenda produto incompatível;
- em sintomas genéricos, recomenda teste antes da troca.

---

## 11. Exemplos de Uso

### Exemplo 1 — Mensagem insuficiente

```txt
Cliente:
"Estou com um problema no meu carro."

Resposta:
"Certo, é um carro. Para eu ajudar melhor, informe o modelo do veículo e o que está acontecendo. Exemplo: 'Meu Onix 2020 não liga' ou 'Meu Gol 1.0 não acende nada'."
```

---

### Exemplo 2 — Carro com modelo e sintoma

```txt
Cliente:
"Estou com problema no meu Onix 2020, ele não quer ligar."

Resposta:
Recomendação de bateria compatível com Onix 2020, com orientação de teste elétrico antes da troca.
```

---

### Exemplo 3 — Moto sem modelo

```txt
Cliente:
"Estou com um problema na minha moto."

Resposta:
"Para recomendar a bateria correta da moto, preciso do modelo e cilindrada. Exemplo: CG 160, Biz 125, Fazer 250 ou XRE 300."
```

---

### Exemplo 4 — Moto com modelo

```txt
Cliente:
"Minha CG 160 não acende nada."

Resposta:
Recomendação de bateria de moto compatível, incluindo teste de bateria e verificação dos terminais.
```

---

### Exemplo 5 — Caminhão

```txt
Cliente:
"Estou com problema no meu caminhão."

Resposta:
"Qual é o modelo do caminhão e ele usa sistema 12V ou 24V?"
```

```txt
Cliente:
"Ele é 24V."

Resposta:
"Certo, sistema 24V. O que acontece com o caminhão?"
```

---

### Exemplo 6 — Mensagem social

```txt
Cliente:
"Obrigado."

Resposta:
"Disponha! Se precisar de ajuda para escolher uma bateria ou tirar dúvidas sobre o veículo, é só me chamar."
```

---

## 12. Backend

### Instalação

Acesse a pasta do backend:

```bash
cd backend
```

Instale as dependências:

```bash
npm install
```

Execute em modo desenvolvimento:

```bash
npm run dev
```

A API ficará disponível em:

```txt
http://localhost:3001/api
```

---

## 13. Frontend

Acesse a pasta do frontend:

```bash
cd frontend
```

Instale as dependências:

```bash
npm install
```

Execute o projeto:

```bash
npm run dev
```

O frontend ficará disponível normalmente em:

```txt
http://localhost:5173
```

---

## 14. Principais Endpoints

### Health Check

```http
GET /api/health
```

Retorno esperado:

```json
{
  "success": true,
  "message": "API BatteryMind rodando com sucesso"
}
```

---

### Listar Produtos

```http
GET /api/produtos
```

---

### Analisar Sentimento

```http
POST /api/analisar-sentimento
Content-Type: application/json

{
  "mensagem": "Meu carro não liga e preciso resolver isso hoje"
}
```

---

### Calcular Fuzzy

```http
POST /api/calcular-fuzzy
Content-Type: application/json

{
  "probabilidadeNegativo": 0.75,
  "urgencia": 0.9,
  "orcamento": 500,
  "estoqueDisponivel": 1,
  "margemLucro": 0.25
}
```

---

### Recomendar Produto

```http
POST /api/recomendar
Content-Type: application/json

{
  "conversationId": "teste1",
  "nomeCliente": "Cliente",
  "mensagem": "Meu Onix 2020 não liga",
  "veiculo": "",
  "orcamentoMaximo": 500,
  "preferencia": "custo-beneficio",
  "urgenciaInformada": "alta"
}
```

---

## 15. Exemplo de Resposta da Recomendação

```json
{
  "success": true,
  "data": {
    "cliente": "Cliente",
    "analiseSentimento": {
      "sentimento": "negativo",
      "probabilidades": {
        "positivo": 0.08,
        "neutro": 0.21,
        "negativo": 0.71
      }
    },
    "analiseFuzzy": {
      "scoreFuzzy": 82,
      "prioridade": "alta"
    },
    "recomendacao": {
      "produto": {
        "nome": "Bateria Moura 60Ah",
        "marca": "Moura",
        "amperagem": 60,
        "precoVenda": 480,
        "garantiaMeses": 18
      },
      "servicos": [
        "Teste elétrico",
        "Teste de bateria",
        "Verificação dos terminais"
      ],
      "justificativa": "Produto compatível com o veículo informado. Como o sintoma é genérico, a recomendação considera uma possível falha de bateria, mas o ideal é realizar teste elétrico antes da troca."
    }
  }
}
```

---

## 16. Estrutura do Backend

```txt
backend/
├── src/
│   ├── controllers/
│   │   ├── analise.controller.ts
│   │   ├── produto.controller.ts
│   │   └── recomendacao.controller.ts
│   │
│   ├── data/
│   │   ├── produtos.data.ts
│   │   └── datasetSentimentos.data.ts
│   │
│   ├── middlewares/
│   │   └── error.middleware.ts
│   │
│   ├── routes/
│   │   ├── index.ts
│   │   ├── analise.routes.ts
│   │   ├── produto.routes.ts
│   │   └── recomendacao.routes.ts
│   │
│   ├── services/
│   │   ├── naiveBayes.service.ts
│   │   ├── fuzzy.service.ts
│   │   ├── geneticAlgorithm.service.ts
│   │   ├── recomendacao.service.ts
│   │   ├── conversationContext.service.ts
│   │   ├── inputValidation.service.ts
│   │   ├── intentDetection.service.ts
│   │   └── symptomTriage.service.ts
│   │
│   ├── types/
│   │   ├── produto.types.ts
│   │   ├── clienteRequest.types.ts
│   │   ├── sentimento.types.ts
│   │   ├── fuzzy.types.ts
│   │   └── recomendacao.types.ts
│   │
│   ├── utils/
│   │   ├── textPreprocessing.ts
│   │   ├── vehicleCompatibility.ts
│   │   ├── response.ts
│   │   └── errors.ts
│   │
│   ├── app.ts
│   └── server.ts
│
├── package.json
├── tsconfig.json
├── .env.example
├── requests.http
└── README.md
```

---

## 17. Relação com a Proposta da Disciplina

O trabalho solicita o desenvolvimento de um sistema inteligente com três camadas principais: PLN com Naive Bayes, Sistema de Inferência Fuzzy e uma meta-heurística para otimização. O BatteryMind atende esses requisitos da seguinte forma:

| Exigência do Trabalho | Aplicação no BatteryMind |
|---|---|
| PLN com Naive Bayes | Classificação do sentimento da mensagem do cliente |
| Pré-processamento de texto | Normalização, tokenização e remoção de termos irrelevantes |
| Sistema Fuzzy | Cálculo de prioridade e tratamento de incerteza |
| Meta-heurística | Algoritmo Genético para escolher a melhor bateria/serviço |
| Dados não estruturados | Mensagens livres enviadas pelo cliente |
| Tomada de decisão | Recomendação de bateria compatível e serviços necessários |

---

## 18. Por que este tema foi escolhido?

O tema foi escolhido por representar um problema real de atendimento em uma loja de baterias.

A recomendação de uma bateria não depende apenas do preço. É necessário considerar:

- compatibilidade com o veículo;
- tipo de uso;
- sintoma apresentado;
- urgência;
- estoque;
- margem;
- garantia;
- segurança da aplicação.

Além disso, o cliente geralmente se comunica por mensagens curtas e incompletas. Isso torna o problema adequado para o uso de IA, pois exige interpretação de texto, tratamento de incerteza e otimização da decisão.

---

## 19. Limitações do Projeto

Por ser um projeto acadêmico, o sistema possui algumas limitações:

- os dados de produtos estão em memória;
- o dataset de sentimentos é pequeno;
- a recomendação não substitui uma avaliação técnica real;
- o sistema faz triagem, não diagnóstico definitivo;
- a compatibilidade dos produtos é simplificada;
- não há autenticação de usuários;
- não há banco de dados em produção.

---

## 20. Trabalhos Futuros

Como melhorias futuras, poderiam ser implementados:

- integração com banco de dados;
- cadastro real de produtos;
- painel administrativo;
- histórico de atendimentos;
- integração com WhatsApp;
- treinamento com dataset maior;
- melhoria do classificador de sentimentos;
- autenticação de usuários;
- relatórios de atendimentos e recomendações;
- integração com estoque real da loja.

---

## 21. Conclusão

O BatteryMind demonstra a aplicação prática de técnicas de Inteligência Artificial em um cenário comercial real.

O sistema combina PLN, Lógica Fuzzy e Algoritmo Genético para interpretar mensagens, lidar com incertezas e recomendar produtos de forma mais segura.

A solução evita recomendações incorretas, solicita informações quando necessário e utiliza critérios técnicos para indicar a bateria mais adequada ao cliente.
