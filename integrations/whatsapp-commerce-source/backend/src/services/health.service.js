export const getHealthStatus = async () => {
  return {
    success: true,
    service: 'whatsapp-commerce-api',
    timestamp: new Date().toISOString()
  };
};
