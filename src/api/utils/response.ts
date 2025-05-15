export const createSuccessResponse = (data: any = {}) => ({
  success: true,
  ...data,
});

export const createErrorResponse = (error: string, details?: any) => ({
  success: false,
  error,
  ...(details && { details }),
});
