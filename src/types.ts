export interface ModelManifest {
  id: string;
  name: string;
  description: string;
  created: string;
  notes: string;
}

export interface ModelInfo extends ModelManifest {
  ready: boolean;
  missingFiles: string[];
  loaded: boolean;
}

export interface PredictRequestBody {
  model: string;
  text: string;
  questions: Record<string, unknown>;
}

export interface PredictBatchRequestBody {
  model: string;
  texts: string[];
  questions: Record<string, unknown>;
}

export interface ErrorResponse {
  error: string;
  message: string;
}
