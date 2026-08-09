# Blackbox Testing Document - Bengkel Dika Motor Website

## 1. Navigation Menu Testing

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status |
|--------------|---------------|------------|-----------|-----------------|---------------|---------|
| NAV-01 | Verify all navigation links | 1. Click Home link<br>2. Click Tentang Kami link<br>3. Click Produk link<br>4. Click Kontak link | N/A | Each link should scroll to respective section | - | To Test |
| NAV-02 | Hamburger menu on mobile | 1. View site on mobile device<br>2. Click hamburger icon | N/A | Menu should toggle visibility | - | To Test |

## 2. Shopping Cart Testing

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status |
|--------------|---------------|------------|-----------|-----------------|---------------|---------|
| CART-01 | Add item to cart | 1. Click cart icon on product<br>2. Verify cart counter | Product item | 1. Item added to cart<br>2. Cart counter incremented | - | To Test |
| CART-02 | Remove item from cart | 1. Add item to cart<br>2. Click minus button<br>3. Verify cart counter | Product item | Item quantity decreased or removed | - | To Test |
| CART-03 | View cart total | 1. Add multiple items<br>2. Check total price | Multiple products | Total should be sum of (price × quantity) | - | To Test |

## 3. Product Management (Admin)

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status |
|--------------|---------------|------------|-----------|-----------------|---------------|---------|
| PROD-01 | Add new product | 1. Fill product form<br>2. Upload image<br>3. Submit form | Name: "Test Oil"<br>Image: test.jpg<br>Price: 50000<br>Detail: "Test description" | Product added successfully | - | To Test |
| PROD-02 | Edit product | 1. Click edit button<br>2. Modify fields<br>3. Submit changes | Updated price: 55000 | Product updated successfully | - | To Test |
| PROD-03 | Delete product | 1. Click delete button<br>2. Confirm deletion | Existing product | Product removed from list | - | To Test |

## 4. Image Upload Testing

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status |
|--------------|---------------|------------|-----------|-----------------|---------------|---------|
| IMG-01 | Upload valid image | Upload image within size limit | Valid .jpg file < 2MB | Image uploaded successfully | - | To Test |
| IMG-02 | Upload invalid file | Try uploading non-image file | .pdf file | Error message shown | - | To Test |
| IMG-03 | Upload large image | Try uploading large image | 5MB image file | Size error message shown | - | To Test |

## 5. Authentication Testing

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status |
|--------------|---------------|------------|-----------|-----------------|---------------|---------|
| AUTH-01 | Admin login | 1. Enter credentials<br>2. Submit login form | Valid admin credentials | Successful login, redirect to admin panel | - | To Test |
| AUTH-02 | Invalid login | Enter wrong credentials | Invalid credentials | Error message shown | - | To Test |
| AUTH-03 | Logout | Click logout button | N/A | Session ended, redirect to login | - | To Test |

## 6. Product Detail Modal

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status |
|--------------|---------------|------------|-----------|-----------------|---------------|---------|
| MOD-01 | View product detail | Click eye icon on product | Product item | Modal shows with correct details | - | To Test |
| MOD-02 | Close modal | Click X button | N/A | Modal closes | - | To Test |

## 7. Contact Feature

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status |
|--------------|---------------|------------|-----------|-----------------|---------------|---------|
| CONT-01 | Open WhatsApp | Click WhatsApp button | N/A | Opens WhatsApp with preset message | - | To Test |
| CONT-02 | View map | Load contact section | N/A | Google Maps iframe loads correctly | - | To Test |

## 8. Responsive Design Testing

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status |
|--------------|---------------|------------|-----------|-----------------|---------------|---------|
| RESP-01 | Mobile view | View on mobile device | Various screen sizes | Layout adjusts properly | - | To Test |
| RESP-02 | Tablet view | View on tablet device | Various screen sizes | Layout adjusts properly | - | To Test |
| RESP-03 | Desktop view | View on desktop | Various screen sizes | Layout adjusts properly | - | To Test |

## Instructions for Testing

1. Each test case should be executed in order
2. Record actual results as tests are performed
3. Mark status as:
   - PASS: Test successful
   - FAIL: Test unsuccessful (document issue)
   - BLOCKED: Cannot test due to dependency
   - N/A: Not applicable

## Test Environment Requirements

- Browser: Chrome (latest), Firefox (latest), Safari (latest)
- Devices: Desktop, Tablet, Mobile
- Screen resolutions: 1920×1080, 1366×768, 375×667 (iPhone)
- Network conditions: Test under various speeds
- Server: Local XAMPP environment and Production server
