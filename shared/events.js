// Definición de eventos compartidos entre microservicios

const EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  USER_REGISTERED: 'user.registered',
  NOTIFICATION_SENT: 'notification.sent'
};

const EXCHANGES = {
  ECOMMERCE_EVENTS: 'ecommerce.events'
};

const QUEUES = {
  ORDERS_CREATED: 'orders.created',
  NOTIFICATIONS_SEND: 'notifications.send'
};

module.exports = {
  EVENTS,
  EXCHANGES,
  QUEUES
};