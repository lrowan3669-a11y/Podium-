function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

module.exports = { must };
