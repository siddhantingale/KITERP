// Integration shortcuts, e.g. import { UploadFile, InvokeLLM } from "@/integrations/Core";
import { api } from '@/api/client';

export const Core = api.integrations.Core;
export const UploadFile = Core.UploadFile;
export const InvokeLLM = Core.InvokeLLM;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
export const SendEmail = Core.SendEmail;
export const SendSMS = Core.SendSMS;
export const GenerateImage = Core.GenerateImage;
