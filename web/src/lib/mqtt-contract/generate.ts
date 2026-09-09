import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(ROOT, 'mqtt-contract', 'contract.json');
const TS_OUTPUT = path.join(ROOT, 'mqtt-contract', 'mqtt-contract.generated.ts');
const PY_OUTPUT = path.join(ROOT, 'firmware', 'src', 'mqtt_contract.py');

const HEADER_TS =
	'// AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.\n' +
	'// Run: npm run generate (from mqtt-contract/)\n';

const HEADER_PY =
	'# AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.\n' +
	'# Run: npm run generate (from mqtt-contract/)\n';

const JSON_TYPE_TO_TS: Record<string, string> = {
	string: 'string',
	boolean: 'boolean',
	integer: 'number',
	number: 'number'
};

function loadContract() {
	const content = fs.readFileSync(CONTRACT_PATH, 'utf-8');
	return JSON.parse(content);
}

function toPascal(snake: string): string {
	return snake
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join('');
}

function schemaToTs(schema: any, indent = 0): string {
	const t = schema.type;

	if ('const' in schema) {
		const val = schema.const;
		return typeof val === 'string' ? `'${val}'` : JSON.stringify(val);
	}

	if ('enum' in schema) {
		return schema.enum.map((v: any) => `'${v}'`).join(' | ');
	}

	if (t === 'array') {
		const itemType = schemaToTs(schema.items || {}, indent);
		return `(${itemType})[]`;
	}

	if (t === 'object') {
		const props = schema.properties || {};
		const propKeys = Object.keys(props);
		if (propKeys.length === 0) {
			return 'Record<string, unknown>';
		}
		const pad = '\t'.repeat(indent + 1);
		const padClose = '\t'.repeat(indent);
		const lines: string[] = [];
		for (const name of propKeys) {
			const propSchema = props[name];
			const opt = propSchema.required ? '' : '?';
			const tsType = schemaToTs(propSchema, indent + 1);
			lines.push(`${pad}${name}${opt}: ${tsType};`);
		}
		return '{\n' + lines.join('\n') + `\n${padClose}}`;
	}

	return JSON_TYPE_TO_TS[t] || 'unknown';
}

function generateTs(contract: any): string {
	const prefix = contract.topicPrefix;
	const messages = contract.messages;

	const out: string[] = [HEADER_TS];

	out.push(`export const TOPIC_PREFIX = '${prefix}';\n`);

	out.push('export const SUBTOPICS = {');
	for (const [name, msg] of Object.entries<any>(messages)) {
		out.push(`\t${name}: '${msg.subtopic}',`);
	}
	out.push('} as const;\n');

	out.push('export type SubtopicKey = keyof typeof SUBTOPICS;\n');

	out.push(
		'export function deviceTopic(deviceSlug: string, subtopic: string): string {\n' +
			'\treturn `${TOPIC_PREFIX}/${deviceSlug}/${subtopic}`;\n' +
			'}\n'
	);

	for (const [name, msg] of Object.entries<any>(messages)) {
		const typeName = toPascal(name) + 'Payload';
		const schema = msg.payload;

		const props = schema.properties || {};
		for (const [propName, propSchema] of Object.entries<any>(props)) {
			if ('enum' in propSchema) {
				const enumTypeName = toPascal(name) + toPascal(propName);
				const enumVals = propSchema.enum.map((v: any) => `'${v}'`).join(' | ');
				out.push(`export type ${enumTypeName} = {enumVals};\n`.replace('{enumVals}', enumVals));
			}
		}

		const tsType = schemaToTs(schema);
		out.push(`export type ${typeName} = ${tsType};\n`);
	}

	out.push(
		`export const SCAN_WILDCARD = \`\${TOPIC_PREFIX}/+/\${SUBTOPICS.scan}\`;\n` +
			`export const STATUS_WILDCARD = \`\${TOPIC_PREFIX}/+/\${SUBTOPICS.status}\`;\n`
	);

	return out.join('\n');
}

function generatePy(contract: any): string {
	const prefix = contract.topicPrefix;
	const messages = contract.messages;

	const out: string[] = [HEADER_PY];

	out.push(`TOPIC_PREFIX = "${prefix}"\n`);

	for (const [name, msg] of Object.entries<any>(messages)) {
		out.push(`SUBTOPIC_${name.toUpperCase()} = "${msg.subtopic}"`);
	}
	out.push('');

	const cmdTrigger = messages.cmd_trigger || {};
	const triggerPayload = cmdTrigger.payload || {};
	const triggerProperties = triggerPayload.properties || {};
	const actionEnum = triggerProperties.action?.enum;
	if (actionEnum) {
		const vals = actionEnum.map((v: any) => `"${v}"`).join(', ');
		out.push(`TRIGGER_ACTIONS = (${vals})\n`);
	}

	out.push(
		'\ndef device_topic(user, subtopic):\n' +
			'    return "{}/{}/{}".format(TOPIC_PREFIX, user, subtopic)\n'
	);

	return out.join('\n');
}

function main() {
	const checkMode = process.argv.includes('--check');
	const contract = loadContract();

	const generated = [
		{ path: TS_OUTPUT, content: generateTs(contract) },
		{ path: PY_OUTPUT, content: generatePy(contract) }
	];

	if (checkMode) {
		let ok = true;
		for (const item of generated) {
			const relPath = path.relative(ROOT, item.path);
			if (!fs.existsSync(item.path)) {
				console.log(`MISSING: ${relPath}`);
				ok = false;
			} else {
				const actual = fs.readFileSync(item.path, 'utf-8');
				if (actual !== item.content) {
					console.log(`OUT OF DATE: ${relPath}`);
					ok = false;
				} else {
					console.log(`OK: ${relPath}`);
				}
			}
		}
		if (!ok) {
			console.log('\nRun: npm run mqtt-contract:generate');
			process.exit(1);
		}
		console.log('\nAll generated files are up to date.');
	} else {
		for (const item of generated) {
			const relPath = path.relative(ROOT, item.path);
			const dir = path.dirname(item.path);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(item.path, item.content, 'utf-8');
			console.log(`Generated ${relPath}`);
		}
	}
}

main();
