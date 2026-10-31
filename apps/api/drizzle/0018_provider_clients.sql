-- OAuth clients this server registered with a provider's authorization server (RFC 7591), one per provider and issuer:
-- COROS's MCP server hands out a client id on the first connect instead of a developer console
CREATE TABLE `provider_clients` (
	`provider` text NOT NULL,
	`issuer` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text,
	`redirect_uri` text NOT NULL,
	`registered_at` text NOT NULL,
	PRIMARY KEY(`provider`, `issuer`)
);
