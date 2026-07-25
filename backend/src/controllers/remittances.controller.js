const { Op } = require('sequelize');
const { RemittanceFile, Remittance, RemittanceLine, DenialReason, UploadedFile, Claim } = require('../models');

exports.listFiles = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, search, dateFrom, dateTo } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (search) {
      where[Op.or] = [
        { payer_name: { [Op.iLike]: `%${search}%` } },
        { payee_name: { [Op.iLike]: `%${search}%` } },
        { trace_number: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (dateFrom || dateTo) {
      where.payment_date = {};
      if (dateFrom) where.payment_date[Op.gte] = dateFrom;
      if (dateTo) where.payment_date[Op.lte] = dateTo;
    }
    const { rows, count } = await RemittanceFile.findAndCountAll({
      where,
      include: [{ model: UploadedFile, attributes: ['filename', 'status', 'uploaded_at', 'parsed_at'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });
    res.json({
      files: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    next(error);
  }
};

exports.getFile = async (req, res, next) => {
  try {
    const remittanceFile = await RemittanceFile.findByPk(req.params.id, {
      include: [
        { model: UploadedFile, attributes: ['filename', 'status', 'uploaded_at', 'parsed_at'] },
        {
          model: Remittance,
          include: [
            { model: Claim, attributes: [
              'id', 'claim_id', 'patient_first_name', 'patient_middle_initial', 'patient_last_name',
              'patient_suffix', 'patient_dob', 'patient_gender', 'patient_member_id',
              'patient_relationship_code', 'patient_address1', 'patient_address2',
              'patient_city', 'patient_state', 'patient_zip',
              'subscriber_first_name', 'subscriber_middle_initial', 'subscriber_last_name',
              'subscriber_suffix', 'subscriber_id', 'subscriber_group_number',
            ]},
            { model: DenialReason },
            {
              model: RemittanceLine,
              include: [{ model: DenialReason }],
            },
          ],
        },
      ],
    });
    if (!remittanceFile) return res.status(404).json({ error: 'Remittance file not found' });
    res.json({ file: remittanceFile });
  } catch (error) {
    next(error);
  }
};
