### Task 1: Update Database Models

**Files:**
- Modify: `backend/src/models/UploadedFile.js`
- Modify: `backend/src/models/Claim.js`
- Modify: `backend/src/models/Remittance.js`

- [ ] **Add `supersedes_id` and `correction_notes` to UploadedFile, extend status enum, add filename index**

In `UploadedFile.js`, add to the model definition:
```js
supersedes_id: { type: DataTypes.UUID, allowNull: true },
correction_notes: { type: DataTypes.TEXT, allowNull: true },
```

Change the `status` validate `isIn` to include `'replaced'`:
```js
status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending',
  validate: { isIn: [['pending', 'parsing', 'parsed', 'duplicate', 'error', 'replaced']] } },
```

Add a filename index to the indexes array:
```js
{ fields: ['filename'] },
```

- [ ] **Add `superseded_by_id` to Claim, extend status enum**

In `Claim.js`, add:
```js
superseded_by_id: { type: DataTypes.UUID, allowNull: true },
```

Change the `status` validate to:
```js
status: { type: DataTypes.STRING(20), defaultValue: 'submitted',
  validate: { isIn: [['submitted', 'paid', 'denied', 'partial', 'replaced']] } },
```

- [ ] **Add `superseded_by_id` to Remittance, extend status enum**

In `Remittance.js`, add:
```js
superseded_by_id: { type: DataTypes.UUID, allowNull: true },
```

Change the `status` validate to:
```js
status: { type: DataTypes.STRING(20), defaultValue: 'pending',
  validate: { isIn: [['pending', 'paid', 'denied', 'partial', 'replaced']] } },
```
