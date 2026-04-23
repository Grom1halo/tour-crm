import { Router } from 'express';
import * as authController from '../controllers/authController';
import * as clientController from '../controllers/clientController';
import * as voucherController from '../controllers/voucherController';
import * as paymentController from '../controllers/paymentController';
import * as referenceController from '../controllers/referenceController';
import * as reportsController from '../controllers/reportsController';
import * as usersController from '../controllers/usersController';
import * as exportController from '../controllers/exportController';
import * as accountingController from '../controllers/accountingController';
import * as statisticsController from '../controllers/statisticsController';
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
router.get('/clients', authenticate, authorize('admin', 'manager'), clientController.getClients);
router.post('/clients', authenticate, authorize('admin', 'manager'), clientController.createClient);
router.put('/clients/:id', authenticate, authorize('admin', 'manager'), clientController.updateClient);
router.delete('/clients/:id', authenticate, authorize('admin'), clientController.deleteClient);

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
router.patch('/vouchers/:id/served', authenticate, authorize('manager', 'admin'), voucherController.toggleServed);
router.patch('/vouchers/:id/confirm', authenticate, authorize('admin', 'accountant'), voucherController.confirmVoucher);

// ===== PAYMENTS =====
router.post('/payments', authenticate, authorize('manager', 'admin', 'accountant'), paymentController.addPayment);
router.put('/payments/:id', authenticate, authorize('manager', 'admin', 'accountant'), paymentController.updatePayment);
router.delete('/payments/:id', authenticate, authorize('manager', 'admin', 'accountant'), paymentController.deletePayment);

// ===== REPORTS =====
router.get('/reports/totals', authenticate, reportsController.getReportTotals);
router.get('/reports/summary', authenticate, reportsController.getSummaryReport);
router.get('/reports/payments', authenticate, reportsController.getPaymentsReport);
router.get('/reports/detail', authenticate, reportsController.getDetailReport);
router.get('/reports/export/daily', authenticate, exportController.exportDailyAccounting);
router.get('/reports/export/manager', authenticate, exportController.exportManagerReport);
router.get('/reports/export/hotline', authenticate, exportController.exportHotlineReport);
router.get('/reports/export/html', authenticate, exportController.exportHtmlReport);
router.get('/reports/export/full', authenticate, exportController.exportFullReport);
router.get('/reports/export/accounting', authenticate, authorize('admin', 'accountant'), exportController.exportAccountingReport);

// ===== REFERENCE DATA =====
router.get('/companies', authenticate, referenceController.getCompanies);
router.post('/companies', authenticate, authorize('admin', 'editor'), referenceController.createCompany);
router.put('/companies/:id', authenticate, authorize('admin', 'editor'), referenceController.updateCompany);
router.delete('/companies/:id', authenticate, authorize('admin', 'editor'), referenceController.deleteCompany);

router.get('/tours', authenticate, referenceController.getTours);
router.post('/tours', authenticate, authorize('admin', 'editor', 'manager'), referenceController.createTour);
router.put('/tours/:id', authenticate, authorize('admin', 'editor'), referenceController.updateTour);
router.delete('/tours/:id', authenticate, authorize('admin', 'editor'), referenceController.deleteTour);

router.get('/tour-prices', authenticate, referenceController.getTourPricesList);
router.post('/tour-prices', authenticate, authorize('admin'), referenceController.createTourPrice);
router.put('/tour-prices/:id', authenticate, authorize('admin'), referenceController.updateTourPrice);
router.delete('/tour-prices/:id', authenticate, authorize('admin'), referenceController.deleteTourPrice);

router.get('/agents', authenticate, referenceController.getAgents);
router.post('/agents', authenticate, authorize('admin'), referenceController.createAgent);
router.put('/agents/:id', authenticate, authorize('admin'), referenceController.updateAgent);
router.delete('/agents/:id', authenticate, authorize('admin'), referenceController.deleteAgent);

router.get('/payment-methods', authenticate, referenceController.getPaymentMethods);
router.post('/payment-methods', authenticate, authorize('admin', 'accountant'), referenceController.createPaymentMethod);
router.put('/payment-methods/:id', authenticate, authorize('admin', 'accountant'), referenceController.updatePaymentMethod);
router.delete('/payment-methods/:id', authenticate, authorize('admin', 'accountant'), referenceController.deletePaymentMethod);

router.get('/seasons', authenticate, referenceController.getSeasons);
router.post('/seasons', authenticate, authorize('admin'), referenceController.createSeason);
router.put('/seasons/:id', authenticate, authorize('admin'), referenceController.updateSeason);
router.delete('/seasons/:id', authenticate, authorize('admin'), referenceController.deleteSeason);

// ===== STATISTICS =====
router.get('/statistics/monthly', authenticate, authorize('admin', 'accountant'), statisticsController.getMonthlyStats);
router.get('/statistics/seasons', authenticate, authorize('admin', 'accountant'), statisticsController.getSeasonStats);
router.get('/statistics/all-time', authenticate, authorize('admin', 'accountant'), statisticsController.getAllTimeStats);
router.get('/statistics/by-tour', authenticate, authorize('admin', 'accountant'), statisticsController.getStatsByTour);
router.get('/statistics/by-company', authenticate, authorize('admin', 'accountant'), statisticsController.getStatsByCompany);
router.get('/statistics/by-client', authenticate, authorize('admin', 'accountant'), statisticsController.getStatsByClient);

// ===== ACCOUNTING =====
router.get('/accounting/revenue', authenticate, authorize('admin', 'accountant'), accountingController.getRevenueBreakdown);
router.get('/accounting/dashboard', authenticate, authorize('admin', 'accountant'), accountingController.getAccountingDashboard);
router.get('/accounting/cashflow', authenticate, authorize('admin', 'accountant'), accountingController.getCashflow);
router.get('/accounting/balances', authenticate, authorize('admin', 'accountant'), accountingController.getPaymentMethodBalances);
router.post('/accounting/cashflow', authenticate, authorize('admin', 'accountant'), accountingController.addCashflowEntry);
router.put('/accounting/cashflow/:id', authenticate, authorize('admin', 'accountant'), accountingController.updateCashflowEntry);
router.delete('/accounting/cashflow/:id', authenticate, authorize('admin', 'accountant'), accountingController.deleteCashflowEntry);
router.patch('/accounting/cashflow/:id/confirm', authenticate, authorize('admin', 'accountant'), accountingController.confirmCashflowEntry);
router.get('/accounting/operators', authenticate, authorize('admin', 'accountant'), accountingController.getOperatorReconciliation);
router.post('/accounting/operators/pay', authenticate, authorize('admin', 'accountant'), accountingController.payOperatorVouchers);
router.post('/accounting/operators/writeoff', authenticate, authorize('admin', 'accountant'), accountingController.writeOffOperatorDebt);
router.get('/accounting/company/:id/history', authenticate, authorize('admin', 'accountant'), accountingController.getCompanyPaymentHistory);
router.post('/accounting/operators/close-period', authenticate, authorize('admin', 'accountant'), accountingController.closeOperatorPeriod);
router.get('/accounting/employees', authenticate, authorize('admin', 'accountant'), accountingController.getEmployeeData);
router.post('/accounting/employee-payments', authenticate, authorize('admin', 'accountant'), accountingController.addEmployeePayment);
router.put('/accounting/employee-payments/:id', authenticate, authorize('admin', 'accountant'), accountingController.updateEmployeePayment);
router.delete('/accounting/employee-payments/:id', authenticate, authorize('admin', 'accountant'), accountingController.deleteEmployeePayment);
router.put('/accounting/employees/:id/salary', authenticate, authorize('admin', 'accountant'), accountingController.updateEmployeeSalary);
router.get('/accounting/agents', authenticate, authorize('admin', 'accountant'), accountingController.getAgentReconciliation);
router.post('/accounting/agents/pay', authenticate, authorize('admin', 'accountant'), accountingController.payAgentVouchers);
router.post('/accounting/agents/writeoff', authenticate, authorize('admin', 'accountant'), accountingController.writeOffAgentDebt);

export default router;
