export interface CCCDInfo {
  id?: string;
  idNumber: string;
  issueDate: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  permanentResidence: string;
}

export interface ExtractionResult {
  data: CCCDInfo | null;
  error?: string;
}
