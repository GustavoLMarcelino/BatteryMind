# BatteryMind Backend

API REST do **BatteryMind — Sistema Inteligente de Recomendação para Loja de Baterias Automotivas**.

## Objetivo

Este backend foi criado para um trabalho acadêmico de Inteligência Artificial. A API analisa mensagens de clientes, calcula prioridade de atendimento e recomenda baterias automotivas usando três camadas didáticas de IA:

1. PLN com Naive Bayes
2. Sistema de Inferência Fuzzy
3. Algoritmo Genético

## Tecnologias

- Node.js
- Express
- TypeScript
- CORS
- dotenv
- tsx
- Dados em memória

## Estrutura de Pastas

```txt
backend/
  package.json
  tsconfig.json
  .env.example
  README.md
  src/
    server.ts
    app.ts
    routes/
    controllers/
    services/
    data/
    types/
    utils/
    middlewares/
```

## Como Instalar

```bash
npm install
```

## Como Rodar

```bash
npm run dev
```

Por padrão, a API roda em:

```txt
http://localhost:3001/api
```

## Endpoints

### Health Check

```http
GET /api/health
```

### Produtos

```http
GET /api/produtos
GET /api/produtos/:id
POST /api/produtos
PUT /api/produtos/:id
DELETE /api/produtos/:id
```

### Análise de Sentimento

```http
POST /api/analisar-sentimento
```

Body:

```json
{
  "mensagem": "Meu carro não liga e preciso resolver isso hoje"
}
```

### Cálculo Fuzzy

```http
POST /api/calcular-fuzzy
```

Body:

```json
{
  "probabilidadeNegativo": 0.75,
  "urgencia": 0.9,
  "orcamento": 500,
  "estoqueDisponivel": 1,
  "margemLucro": 0.25
}
```

### Recomendação Principal

```http
POST /api/recomendar
```

Body:

```json
{
  "nomeCliente": "João",
  "mensagem": "Meu carro não liga e preciso de uma bateria hoje, mas queria algo bom e barato",
  "veiculo": "Gol 1.0",
  "orcamentoMaximo": 500,
  "preferencia": "custo-beneficio",
  "urgenciaInformada": "alta"
}
```

## Camadas de IA

### Naive Bayes

O serviço `naiveBayes.service.ts` implementa manualmente uma classificação de sentimento. Ele normaliza texto, remove acentos, remove pontuação, elimina stop words simples em português, tokeniza a mensagem e calcula probabilidades para as classes `positivo`, `neutro` e `negativo`.

### Sistema Fuzzy

O serviço `fuzzy.service.ts` usa funções de pertinência simples para avaliar sentimento negativo, urgência, margem de lucro e estoque. As regras geram um score de 0 a 100, convertido em prioridade `baixa`, `media`, `alta` ou `urgente`.

### Algoritmo Genético

O serviço `geneticAlgorithm.service.ts` representa cada indivíduo como uma recomendação possível. A função fitness considera compatibilidade com veículo, orçamento, margem, estoque, garantia, preferência do cliente e score fuzzy. O algoritmo usa população inicial, seleção, crossover, mutação e 30 gerações.

## Observação Acadêmica

Este projeto usa dados em memória para facilitar apresentação, testes e entendimento didático. Em uma evolução futura, a camada `data` pode ser substituída por banco relacional, MongoDB ou outro repositório persistente.

## Validação de Entrada

Antes de executar Naive Bayes, Fuzzy ou Algoritmo Genético, o endpoint `POST /api/recomendar` tenta extrair dados da mensagem: veículo/modelo, ano, tipo de veículo, problema, intenção, urgência e orçamento.

A validação calcula `inputConfidence` de 0 a 100:

- +30 se tiver veículo informado ou extraído da mensagem
- +30 se tiver problema detectado
- +20 se tiver contexto automotivo/bateria
- +10 se tiver urgência clara
- +10 se tiver orçamento detectado

Se `inputConfidence` for menor que 50, ou se faltar contexto essencial, a API retorna `success: false` e não recomenda produto.

Exemplo de entrada insuficiente:

```json
{
  "nomeCliente": "Cliente",
  "mensagem": "estou",
  "veiculo": "",
  "orcamentoMaximo": 0,
  "preferencia": "custo-beneficio",
  "urgenciaInformada": "baixa"
}
```

Exemplo de entrada válida com extração:

```json
{
  "nomeCliente": "Cliente",
  "mensagem": "Tenho um virtus 2018 que não esta ligando",
  "veiculo": "",
  "orcamentoMaximo": 0,
  "preferencia": "custo-beneficio",
  "urgenciaInformada": "baixa"
}
```

Nesse caso, a API extrai `Virtus 2018`, detecta o problema `nao esta ligando`, calcula `inputConfidence: 80` e continua a recomendação usando o veículo extraído.

Resposta:

```json
{
  "success": false,
  "type": "INSUFFICIENT_INFORMATION",
  "message": "Não consegui identificar uma necessidade relacionada a bateria automotiva.",
  "data": {
    "reason": "Mensagem muito curta ou fora do contexto",
    "missingFields": ["veiculo", "descricaoProblema"],
    "suggestedQuestion": "Informe o modelo do veículo e descreva o problema. Exemplo: 'Meu Gol 1.0 não liga e preciso trocar a bateria hoje'.",
    "inputConfidence": 0
  }
}
```

## Testes Manuais

O arquivo `requests.http` contém exemplos para testar no VS Code REST Client, Insomnia ou Postman.

Casos que não devem recomendar:

- `"estou"`
- `"oi"`
- `"qual valor?"`
- `"preciso de bateria"`
- `"meu carro não liga"` sem informar o modelo do veículo
- `"tenho um caminhão"` sem modelo, tensão e problema

Casos que devem recomendar:

- `"Meu Gol 1.0 não liga e preciso de uma bateria hoje"` com veículo `Gol 1.0`
- `"Tenho um virtus 2018 que não esta ligando"` mesmo com campo `veiculo` vazio
- `"Tenho um Onix 2020 e queria uma bateria até 500 reais"` mesmo com campo `veiculo` vazio

## Contexto Conversacional

O endpoint `POST /api/recomendar` aceita `conversationId`. Quando ele não é enviado, a API usa `default`. O contexto fica em memória e acumula:

- mensagens anteriores
- tipo de veículo
- modelo
- ano
- tensão `12V` ou `24V`
- problema
- orçamento
- preferência
- urgência

Fluxo exemplo:

1. Cliente: `"estou com um problema no meu caminhão"`
   Resposta: pede modelo e tensão.
2. Cliente: `"ele usa 24V"`
   A API entende que `ele` é o caminhão da conversa e salva `tensao: "24V"`.
3. Cliente: `"é um caminhão 24V que não está ligando"`
   A API recomenda produto compatível com `Caminhão 24V`.

Endpoints de contexto:

```http
GET /api/conversas/:conversationId
DELETE /api/conversas/:conversationId
```

## Intenções Sociais

Antes de atualizar contexto ou validar necessidade automotiva, a API detecta mensagens sociais como saudação, agradecimento, confirmação e despedida.

Essas mensagens retornam `type: "SOCIAL_RESPONSE"` e não executam Naive Bayes, Fuzzy ou Algoritmo Genético.

Exemplos:

- `"obrigado"` retorna `"Disponha! Se precisar de ajuda para escolher uma bateria ou tirar dúvidas sobre o veículo, é só me chamar."`
- `"oi"` retorna `"Olá! Me informe o modelo do veículo e o problema apresentado para eu ajudar a encontrar a melhor bateria."`
- `"ok"` retorna `"Certo. Se quiser, me informe o modelo do veículo e o que está acontecendo para eu continuar a análise."`
- `"tchau"` retorna `"Até mais! Quando precisar, posso ajudar a encontrar a bateria ideal para o seu veículo."`

## Regras Técnicas por Veículo

O contexto detecta troca de assunto. Se a conversa estava em `Onix 2020` e o cliente passa a falar de `moto`, os dados antigos do carro são descartados para evitar recomendação cruzada.

- Carro: pode recomendar com modelo reconhecido e sintoma/intenção.
- Moto: só recomenda com modelo/cilindrada, como `CG 160`, `Biz 125`, `Fazer 250` ou `XRE 300`.
- Caminhão: exige tensão `12V` ou `24V`; se o cliente responder apenas `24` após a pergunta de tensão, a API interpreta como `24V`.

## Triagem de Sintomas

Antes da recomendação final, a API classifica o sintoma:

- `sem_energia`: não acende nada, painel não acende, morreu tudo.
- `bateria_fraca`: painel pisca, partida pesada, motor gira fraco.
- `problema_recorrente`: vive descarregando, sempre descarrega.
- `generico_nao_liga`: não liga, não quer ligar, não pega.

Essa triagem não substitui as camadas de IA. Ela evita recomendações inseguras e adiciona serviços técnicos, como `Teste elétrico`, `Teste de bateria` e `Verificação dos terminais`.

O retorno também inclui `confidenceLabel`:

- `0-49`: baixa confiança
- `50-69`: confiança moderada
- `70-84`: boa recomendação
- `85-100`: recomendação otimizada
