ALTER TABLE companies ADD COLUMN "subscriptionQuantity" integer CHECK ("subscriptionQuantity" IS NULL OR "subscriptionQuantity" > 0);
