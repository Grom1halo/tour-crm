import { Router } from 'express';
import * as authController from '../controllers/authController';
import * as clientController from '../controllers/clientController';
import * as voucherController from '../controllers/voucherController';
import * as paymentController from '../controllers/paymentController';
import * as referenceController from '../controllers/referenceController';
import * as reportsController from '../controllers/reportsController';
import * as usersController from '../controllers/usersController';
import * as exportController from '../controllers/exportController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// ===== AUTH =====
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticate, authController.getCurrentUser);

// ===== USERS =====
router.get('/users/managers', authenticate, usersController.getManagers);
router.put('/users/phone', authenticate, usersController.updateManagerPhone);
router.post('/users', authenticate, authorize('admin'), usersController.createUser);
router.put('/users/:id', authenticate, authorize('admin'), usersController.updateUser);
router.delete('/users/:id', authenticate, authorize('admin'), usersController.deleteUser);

// ===== CLIENTS =====
router.get('/clients', authenticate, clientController.getClients);
router.post('/clients', authenticate, authorize('manager', 'admin'), clientController.createClient);
router.put('/clients/:id', authenticate, authorize('manager', 'admin'), clientController.updateClient);
router.delete('/clients/:id', authenticate, authorize('manager', 'admin'), clientController.deleteClient);

// ===== VOUCHERS =====
router.get('/vouchers/prices/lookup', authenticate, voucherController.getTourPrices);
router.get('/vouchers/by-company/:companyId', authenticate, voucherController.getToursByCompany);
router.get('/vouchers/by-tour/:tourId', authenticate, voucherController.getCompaniesByTour);
router.get('/vouchers', authenticate, voucherController.getVouchers);
router.get('/vouchers/:id', authenticate, voucherController.getVoucherById);
router.post('/vouchers', authenticate, authorize('manager', 'admin'), voucherController.createVoucher);
router.put('/vouchers/:id', authenticate, authorize('manager', 'admin'), voucherController.updateVoucher);
router.delete('/vouchers/:id', authenticate, authorize('manager', 'admin'), voucherController.deleteVoucher);
router.post('/vouchers/:id/restore', authenticate, authorize('manager', 'admin'), voucherController.restoreVoucher);
router.post('/vouchers/:id/copy', authenticate, authorize('manager', 'admin'), voucherController.copyVoucher);

// ===== PAYMENTS =====
router.post('/payments', authenticate, authorize('manager', 'admin', 'accountant'), paymentController.addPayment);
router.put('/payments/:id', authenticate, authorize('manager', 'admin', 'accountant'), paymentController.updatePayment);
router.delete('/payments/:id', authenticate, authorize('manager', 'admin', 'accountant'), paymentController.deletePayment);

// ===== REPORTS =====
router.get('/reports/totals', authenticate, reportsController.getReportTotals);
router.get('/reports/summary', authenticate, reportsController.getSummaryReport);
router.get('/reports/payments', authenticate, reportsController.getPaymentsReport);
router.get('/reports/export/daily', authenticate, exportController.exportDailyAccounting);

// ===== REFERENCE DATA =====
router.get('/companies', authenticate, referenceController.getCompanies);
router.post('/companies', authenticate, authorize('admin', 'manager'), referenceController.createCompany);
router.put('/companies/:id', authenticate, authorize('admin'), referenceController.updateCompany);

router.get('/tours', authenticate, referenceController.getTours);
router.post('/tours', authenticate, authorize('admin', 'manager'), referenceController.createTour);
router.put('/tours/:id', authenticate, authorize('admin'), referenceController.updateTour);

router.get('/tour-prices', authenticate, referenceController.getTourPricesList);
router.post('/tour-prices', authenticate, authorize('admin'), referenceController.createTourPrice);
router.put('/tour-prices/:id', authenticate, authorize('admin'), referenceController.updateTourPrice);
router.delete('/tour-prices/:id', authenticate, authorize('admin'), referenceController.deleteTourPrice);

router.get('/agents', authenticate, referenceController.getAgents);
router.post('/agents', authenticate, authorize('admin'), referenceController.createAgent);
router.put('/agents/:id', authenticate, authorize('admin'), referenceController.updateAgent);
router.delete('/agents/:id', authenticate, authorize('admin'), referenceController.deleteAgent);

router.get('/seasons', authenticate, referenceController.getSeasons);
router.post('/seasons', authenticate, authorize('admin'), referenceController.createSeason);
router.put('/seasons/:id', authenticate, authorize('admin'), referenceController.updateSeason);
router.delete('/seasons/:id', authenticate, authorize('admin'), referenceController.deleteSeason);

export default router;
