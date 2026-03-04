import { Router } from 'express';
import * as authController from '../controllers/authController';
import * as clientController from '../controllers/clientController';
import * as voucherController from '../controllers/voucherController';
import * as paymentController from '../controllers/paymentController';
import * as referenceController from '../controllers/referenceController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// ===== AUTH ROUTES =====
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticate, authController.getCurrentUser);

// ===== CLIENT ROUTES =====
router.get('/clients', authenticate, clientController.getClients);
router.post('/clients', authenticate, authorize('manager', 'admin'), clientController.createClient);
router.put('/clients/:id', authenticate, authorize('manager', 'admin'), clientController.updateClient);
router.delete('/clients/:id', authenticate, authorize('manager', 'admin'), clientController.deleteClient);

// ===== VOUCHER ROUTES =====
router.get('/vouchers', authenticate, voucherController.getVouchers);
router.get('/vouchers/:id', authenticate, voucherController.getVoucherById);
router.post('/vouchers', authenticate, authorize('manager', 'admin'), voucherController.createVoucher);
router.put('/vouchers/:id', authenticate, authorize('manager', 'admin'), voucherController.updateVoucher);
router.delete('/vouchers/:id', authenticate, authorize('manager', 'admin'), voucherController.deleteVoucher);
router.post('/vouchers/:id/restore', authenticate, authorize('manager', 'admin'), voucherController.restoreVoucher);
router.post('/vouchers/:id/copy', authenticate, authorize('manager', 'admin'), voucherController.copyVoucher);
router.get('/vouchers/prices/lookup', authenticate, voucherController.getTourPrices);

// ===== PAYMENT ROUTES =====
router.post('/payments', authenticate, authorize('manager', 'admin', 'accountant'), paymentController.addPayment);
router.put('/payments/:id', authenticate, authorize('manager', 'admin', 'accountant'), paymentController.updatePayment);
router.delete('/payments/:id', authenticate, authorize('manager', 'admin', 'accountant'), paymentController.deletePayment);

// ===== REFERENCE DATA ROUTES (Admin only) =====
// Companies
router.get('/companies', authenticate, referenceController.getCompanies);
router.post('/companies', authenticate, authorize('admin'), referenceController.createCompany);
router.put('/companies/:id', authenticate, authorize('admin'), referenceController.updateCompany);

// Tours
router.get('/tours', authenticate, referenceController.getTours);
router.post('/tours', authenticate, authorize('admin'), referenceController.createTour);
router.put('/tours/:id', authenticate, authorize('admin'), referenceController.updateTour);

// Tour Prices
router.get('/tour-prices', authenticate, referenceController.getTourPricesList);
router.post('/tour-prices', authenticate, authorize('admin'), referenceController.createTourPrice);
router.put('/tour-prices/:id', authenticate, authorize('admin'), referenceController.updateTourPrice);

// Agents
router.get('/agents', authenticate, referenceController.getAgents);
router.post('/agents', authenticate, authorize('admin'), referenceController.createAgent);
router.put('/agents/:id', authenticate, authorize('admin'), referenceController.updateAgent);

export default router;
