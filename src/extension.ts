import * as vscode from 'vscode';
import { getFtpServers, validateFtpServer } from './config';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extensão "FTP Upload" ativa!');

	// Comando para listar os servidores FTP configurados
	const listServersCmd = vscode.commands.registerCommand('ftpUpload.listServers', async () => {
		const servers = getFtpServers();

		if (servers.length === 0) {
			const openSettings = 'Abrir Settings';
			const choice = await vscode.window.showWarningMessage(
				'Nenhum servidor FTP configurado. Configure em Settings > FTP Upload.',
				openSettings
			);
			if (choice === openSettings) {
				vscode.commands.executeCommand('workbench.action.openSettings', 'ftpUpload.servers');
			}
			return;
		}

		// Valida todos os servidores
		let hasErrors = false;
		for (const server of servers) {
			const errors = validateFtpServer(server);
			if (errors.length > 0) {
				hasErrors = true;
				vscode.window.showErrorMessage(
					`Servidor "${server.name || '(sem nome)'}": ${errors.join(', ')}`
				);
			}
		}

		if (hasErrors) {
			return;
		}

		// Mostra um QuickPick com os servidores configurados
		const items = servers.map(s => ({
			label: s.name,
			description: `${s.protocol}://${s.host}:${s.port}`,
			detail: `Diretório remoto: ${s.remotePath}`,
			server: s
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Selecione um servidor FTP',
			title: 'Servidores FTP Configurados'
		});

		if (selected) {
			vscode.window.showInformationMessage(
				`Servidor selecionado: ${selected.server.name} (${selected.server.host})`
			);
			// TODO: Aqui será implementada a lógica de upload
		}
	});

	const downloadDefaultCmd = vscode.commands.registerCommand('ftpUpload.downloadDefault', async () => {
		vscode.window.showInformationMessage('Baixar do FTP padrão (em breve).');
	});

	const downloadSelectCmd = vscode.commands.registerCommand('ftpUpload.downloadSelect', async () => {
		vscode.window.showInformationMessage('Baixar do FTP... (em breve).');
	});

	const uploadDefaultCmd = vscode.commands.registerCommand('ftpUpload.uploadDefault', async () => {
		vscode.window.showInformationMessage('Upload para FTP padrão (em breve).');
	});

	const uploadSelectCmd = vscode.commands.registerCommand('ftpUpload.uploadSelect', async () => {
		vscode.window.showInformationMessage('Upload para FTP... (em breve).');
	});

	context.subscriptions.push(
		listServersCmd,
		downloadDefaultCmd,
		downloadSelectCmd,
		uploadDefaultCmd,
		uploadSelectCmd
	);
}

export function deactivate() {}
