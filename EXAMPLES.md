# Request Examples

Real request and response examples for every question type.
All responses below were captured from a live server run.

See [API.md](API.md) for the full reference, or [README.md](README.md) to get started.

## Contents

- [choice: pick one label](#choice-pick-one-label)
- [noul: probability the statement holds](#noul-probability-the-statement-holds)
- [score: rate 0..n](#score-rate-0n)
- [Multiple questions in one request](#multiple-questions-in-one-request)
- [Batch: many texts at once](#batch-many-texts-at-once)

---

## choice: pick one label

`choice` picks one label from `criteria` and returns `probabilities` for every label.

### Example 1: customer support intent

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "My package has not arrived yet, it has been two weeks.",
    "questions": {
      "intent": {
        "type": "choice",
        "instructions": "What does the customer want?",
        "criteria": {
          "refund": "The customer wants their money back.",
          "shipping": "The customer asks about delivery or shipping.",
          "technical": "The customer has a technical problem.",
          "other": "Anything else."
        }
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "intent": {
      "type": "choice",
      "choice": "shipping",
      "probabilities": {
        "refund": 0.0084,
        "shipping": 0.9895,
        "technical": 0.0009,
        "other": 0.0012
      },
      "confidence": 0.9532,
      "answer_confidence": 0.9895,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 63,
    "output_tokens": 0,
    "state_tokens": 13,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

### Example 2: ticket priority

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "Our production server is completely down, all customers are affected!",
    "questions": {
      "priority": {
        "type": "choice",
        "instructions": "How urgent is this support ticket?",
        "criteria": {
          "low": "Minor issue, no rush.",
          "medium": "Normal issue, needs attention soon.",
          "high": "Serious issue affecting work.",
          "urgent": "Critical outage, immediate action needed."
        }
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "priority": {
      "type": "choice",
      "choice": "urgent",
      "probabilities": {
        "low": 0.0027,
        "medium": 0.0076,
        "high": 0.0184,
        "urgent": 0.9713
      },
      "confidence": 0.8882,
      "answer_confidence": 0.9713,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 63,
    "output_tokens": 0,
    "state_tokens": 12,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

### Example 3: spam detection

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "Congratulations! You won a free iPhone, click here now!!!",
    "questions": {
      "category": {
        "type": "choice",
        "instructions": "Which category best describes this message?",
        "criteria": {
          "spam": "Unsolicited promotion or scam.",
          "question": "A genuine question or request.",
          "complaint": "A complaint or negative feedback.",
          "other": "Anything else."
        }
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "category": {
      "type": "choice",
      "choice": "spam",
      "probabilities": { "spam": 1, "question": 0, "complaint": 0, "other": 0 },
      "confidence": 1,
      "answer_confidence": 1,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 60,
    "output_tokens": 0,
    "state_tokens": 12,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

---

## noul: probability the statement holds

`noul` returns a number between 0 and 1. The engine applies NO threshold:
decide yourself what counts as `true` (commonly 0.5, but it is your call).

### Example 1: is the customer angry?

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "This is the third time I have contacted you and still no answer!",
    "questions": {
      "angry": {
        "type": "noul",
        "instructions": "Is the customer angry or frustrated?",
        "criteria": { "true": "yes, angry or frustrated", "false": "no, calm" }
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "angry": {
      "type": "noul",
      "noul": 0.1473,
      "confidence": 0.8527,
      "answer_confidence": 0.8527,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 43,
    "output_tokens": 0,
    "state_tokens": 14,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

### Example 2: is this message a question?

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "Could you tell me how to reset my password?",
    "questions": {
      "is_question": {
        "type": "noul",
        "instructions": "Is this message a question?",
        "criteria": { "true": "yes, it asks something", "false": "no, it is a statement" }
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "is_question": {
      "type": "noul",
      "noul": 0.5662,
      "confidence": 0.5662,
      "answer_confidence": 0.5662,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 41,
    "output_tokens": 0,
    "state_tokens": 10,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

### Example 3: does the message mention a price?

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "The subscription costs 29 dollars per month, which is too expensive.",
    "questions": {
      "mentions_price": {
        "type": "noul",
        "instructions": "Does the message mention a price or cost?",
        "criteria": { "true": "yes, mentions money or price", "false": "no price mentioned" }
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "mentions_price": {
      "type": "noul",
      "noul": 0.8996,
      "confidence": 0.8996,
      "answer_confidence": 0.8996,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 47,
    "output_tokens": 0,
    "state_tokens": 15,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

---

## score: rate 0..n

`score` returns a number on the scale of your `criteria` array (0 = first level,
1 = second level, and so on), plus a `legend` mapping and per-level `probabilities`.

### Example 1: customer satisfaction

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "The support team was friendly but the problem is still not fixed.",
    "questions": {
      "satisfaction": {
        "type": "score",
        "instructions": "How satisfied is the customer?",
        "criteria": ["very dissatisfied", "dissatisfied", "neutral", "satisfied", "very satisfied"]
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "satisfaction": {
      "type": "score",
      "score": 0.7924,
      "legend": {
        "0": "very dissatisfied",
        "1": "dissatisfied",
        "2": "neutral",
        "3": "satisfied",
        "4": "very satisfied"
      },
      "probabilities": { "0": 0.2305, "1": 0.7488, "2": 0.019, "3": 0.0008, "4": 0.0008 },
      "confidence": 0.6014,
      "answer_confidence": 0.7488,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 58,
    "output_tokens": 0,
    "state_tokens": 13,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

### Example 2: tone formality

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "Dear Sir or Madam, I would like to inquire about your enterprise pricing. Kind regards.",
    "questions": {
      "formality": {
        "type": "score",
        "instructions": "How formal is the tone of this message?",
        "criteria": ["very informal", "informal", "neutral", "formal", "very formal"]
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "formality": {
      "type": "score",
      "score": 1.2631,
      "legend": {
        "0": "very informal",
        "1": "informal",
        "2": "neutral",
        "3": "formal",
        "4": "very formal"
      },
      "probabilities": { "0": 0.0629, "1": 0.6298, "2": 0.2945, "3": 0.0069, "4": 0.0059 },
      "confidence": 0.4472,
      "answer_confidence": 0.6298,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 66,
    "output_tokens": 0,
    "state_tokens": 18,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

### Example 3: request urgency

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "Please fix this whenever you have time, no rush at all.",
    "questions": {
      "urgency": {
        "type": "score",
        "instructions": "How urgent is this request?",
        "criteria": ["no rush", "low urgency", "medium urgency", "high urgency", "critical"]
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "urgency": {
      "type": "score",
      "score": 1.4116,
      "legend": {
        "0": "no rush",
        "1": "low urgency",
        "2": "medium urgency",
        "3": "high urgency",
        "4": "critical"
      },
      "probabilities": { "0": 0.1011, "1": 0.5995, "2": 0.1323, "3": 0.1208, "4": 0.0462 },
      "confidence": 0.2522,
      "answer_confidence": 0.5995,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 60,
    "output_tokens": 0,
    "state_tokens": 13,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

---

## Multiple questions in one request

Mix `choice`, `noul`, and `score` in a single call. They share one forward pass,
so this is cheaper than three separate requests.

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "text": "I am very disappointed, the product broke after one day and I want my money back.",
    "questions": {
      "intent": {
        "type": "choice",
        "instructions": "What does the customer want?",
        "criteria": {
          "refund": "The customer wants their money back.",
          "replacement": "The customer wants a new product.",
          "support": "The customer needs help fixing it.",
          "other": "Anything else."
        }
      },
      "angry": {
        "type": "noul",
        "instructions": "Is the customer angry?",
        "criteria": { "true": "yes, angry", "false": "no, calm" }
      },
      "sentiment": {
        "type": "score",
        "instructions": "How positive is the tone?",
        "criteria": ["very negative", "negative", "neutral", "positive", "very positive"]
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "answers": {
    "intent": {
      "type": "choice",
      "choice": "refund",
      "probabilities": {
        "refund": 0.9973,
        "replacement": 0.0019,
        "support": 0.0006,
        "other": 0.0002
      },
      "confidence": 0.9849,
      "answer_confidence": 0.9973,
      "action": { "act_probability": 1 }
    },
    "angry": {
      "type": "noul",
      "noul": 0.0732,
      "confidence": 0.9268,
      "answer_confidence": 0.9268,
      "action": { "act_probability": 1 }
    },
    "sentiment": {
      "type": "score",
      "score": 0.0967,
      "legend": {
        "0": "very negative",
        "1": "negative",
        "2": "neutral",
        "3": "positive",
        "4": "very positive"
      },
      "probabilities": { "0": 0.9149, "1": 0.0793, "2": 0.0019, "3": 0.002, "4": 0.002 },
      "confidence": 0.8021,
      "answer_confidence": 0.9149,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 173,
    "output_tokens": 0,
    "state_tokens": 18,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

---

## Batch: many texts at once

`POST /v1/predict/batch` runs the same questions over many texts.
The order of `results` matches the order of `texts`.

```bash
curl -X POST http://localhost:3000/v1/predict/batch \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "support-classifier",
    "texts": [
      "How do I cancel my subscription?",
      "The app crashes every time I open it.",
      "Thank you for the quick help!"
    ],
    "questions": {
      "intent": {
        "type": "choice",
        "instructions": "What does the customer want?",
        "criteria": {
          "cancel": "The customer wants to cancel or leave.",
          "technical": "The customer has a technical problem.",
          "praise": "The customer is happy or thankful.",
          "other": "Anything else."
        }
      }
    }
  }'
```

Response:

```json
{
  "model": "support-classifier",
  "results": [
    {
      "model": "support-classifier",
      "answers": {
        "intent": {
          "type": "choice",
          "choice": "cancel",
          "probabilities": { "cancel": 0.9999, "technical": 0, "praise": 0, "other": 0 },
          "confidence": 0.9995,
          "answer_confidence": 0.9999,
          "action": { "act_probability": 1 }
        }
      },
      "usage": { "input_tokens": 57, "output_tokens": 0, "state_tokens": 7 }
    },
    {
      "model": "support-classifier",
      "answers": {
        "intent": {
          "type": "choice",
          "choice": "technical",
          "probabilities": {
            "cancel": 0.0192,
            "technical": 0.9138,
            "praise": 0.0083,
            "other": 0.0587
          },
          "confidence": 0.7371,
          "answer_confidence": 0.9138,
          "action": { "act_probability": 1 }
        }
      },
      "usage": { "input_tokens": 59, "output_tokens": 0, "state_tokens": 9 }
    },
    {
      "model": "support-classifier",
      "answers": {
        "intent": {
          "type": "choice",
          "choice": "praise",
          "probabilities": {
            "cancel": 0.0648,
            "technical": 0.0223,
            "praise": 0.6807,
            "other": 0.2322
          },
          "confidence": 0.3774,
          "answer_confidence": 0.6807,
          "action": { "act_probability": 1 }
        }
      },
      "usage": { "input_tokens": 57, "output_tokens": 0, "state_tokens": 7 }
    }
  ]
}
```

---

## Notes

- The `model` field above uses `support-classifier` as an example. Replace it
  with your own `model_id` (the folder name under `models/`).
- Values like `confidence` and `probabilities` are model output, they will
  differ across models and texts.
- `usage.state_tokens` and `truncated` fields are omitted from some examples
  for brevity; the real API always returns them.
