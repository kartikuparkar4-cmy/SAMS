function notFound(req, res) {
  res.status(404).json({ message: 'The requested resource was not found.' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must contain valid JSON.' });
  }
  if (error.message === 'Origin not allowed') {
    return res.status(403).json({ message: 'This origin is not permitted.' });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: 'The submitted data is invalid.' });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'A request value has an invalid format.' });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'That appointment time is no longer available.' });
  }
  if (error.status && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ message: error.message });
  }

  console.error('Request failed:', error.message);
  return res.status(500).json({ message: 'An unexpected server error occurred. Please try again.' });
}

module.exports = { notFound, errorHandler };