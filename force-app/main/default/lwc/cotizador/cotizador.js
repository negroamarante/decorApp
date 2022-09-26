import { LightningElement, wire, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { getPicklistValues } from "lightning/uiObjectInfoApi";
import TIPO from "@salesforce/schema/Tela__c.Tipo__c";
import getMecanismos from "@salesforce/apex/CotizadorController.getMecanismos";
import getTelas from "@salesforce/apex/CotizadorController.getTelas";
import saveCotization from "@salesforce/apex/CotizadorController.saveCotization";
import { NavigationMixin } from "lightning/navigation";

const COLOCACION = 2500;
const actions = [
  { label: "Editar", name: "edit" },
  { label: "Eliminar", name: "delete" }
];

const columns = [
  {
    label: "Tela",
    fieldName: "telaLink",
    type: "url",
    fixedWidth: 300,
    typeAttributes: {
      label: {
        fieldName: "telaLabel"
      }
    }
  },
  {
    label: "Mecanismo",
    fieldName: "mecanismoLink",
    type: "url",
    fixedWidth: 400,
    typeAttributes: {
      label: {
        fieldName: "mecanismoLink"
      }
    }
  },
  { label: "Ancho", fieldName: "Ancho__c" },
  { label: "Alto", fieldName: "Alto__c" },
  { label: "Cantidad", fieldName: "Cantidad__c", editable: true },
  {
    label: "Precio",
    fieldName: "Precio__c",
    type: "currency",
    cellAttributes: { alignment: "left" }
  },
  {
    label: "Colocacion",
    fieldName: "Colocacion__c",
    type: "currency",
    cellAttributes: { alignment: "left" }
  },
  {
    label: "Precio sin Factura",
    fieldName: "PrecioSinFactura__c",
    type: "currency",
    fixedWidth: 200,
    cellAttributes: { alignment: "left" }
  },
  {
    label: "Precio Final",
    fieldName: "PrecioFinal__c",
    type: "currency",
    cellAttributes: { alignment: "left", class: "slds-text-color_success " }
  },
  {
    type: "action",
    typeAttributes: { rowActions: actions }
  }
];

export default class Cotizador extends NavigationMixin(LightningElement) {
  ganancia = 0.4;
  telas;
  mecanismos;
  picklistValues;
  tipoTela;
  tela;
  mecanismo;
  cantidad = 1;
  ancho;
  alto;
  colocacion = COLOCACION;
  telasRecords = [];
  mecanismosRecords = [];
  columns = columns;
  @track ventanas = [];

  @wire(getPicklistValues, {
    recordTypeId: "012000000000000AAA",
    fieldApiName: TIPO
  })
  wiredPicklist({ data }) {
    if (data) {
      let aux = [];
      data.values.forEach((element) => {
        aux.push({ label: element.label, value: element.value });
      });
      this.picklistValues = [...aux];
    }
  }

  @wire(getTelas, { tipoTela: "$tipoTela" })
  wiredTelas({ data, error }) {
    if (error) console.error(error);
    if (data) {
      this.telasRecords = [...data];
      this.telas = data.map((cls) =>
        Object.assign({}, { label: cls.Name, value: cls.Id })
      );
    }
  }

  @wire(getMecanismos)
  wiredMecanismos({ data, error }) {
    if (error) console.error(error);
    if (data) {
      this.mecanismosRecords = [...data];
      this.mecanismos = data.map((cls) =>
        Object.assign({}, { label: cls.Name, value: cls.Id })
      );
    }
  }

  get showTelas() {
    return this.tipoTela === undefined;
  }
  get showMecanismos() {
    return this.tela === undefined;
  }
  get showInputs() {
    return !this.tela || !this.tipoTela || !this.mecanismo;
  }
  get showAdd() {
    return (
      !this.tela ||
      !this.tipoTela ||
      !this.mecanismo ||
      !this.ancho ||
      !this.alto
    );
  }

  get totalSinFactura() {
    let total = 0;
    this.ventanas.forEach((elem) => {
      total += elem.PrecioSinFactura__c;
    });
    return total;
  }
  get totalConFactura() {
    let total = 0;
    this.ventanas.forEach((elem) => {
      total += elem.PrecioFinal__c;
    });
    return total;
  }

  handleGanancia(event) {
    this.ganancia = Number(event.detail.value);
    if (this.ganancia && this.ventanas) {
      let newArray = [];
      this.ventanas.forEach((elem) => {
        const precio = this.calculatePrecio(
          elem.Alto__c,
          elem.Ancho__c,
          this.telasRecords.find((e) => e.Id === elem.Tela__c).PrecioIVA__c,
          this.mecanismosRecords.find((e) => e.Id === elem.Mecanismo__c)
            .Precio__c,
          this.cantidad
        );
        elem.PrecioFinal__c =
          (precio + elem.Colocacion__c) * (1 + this.ganancia);
        newArray.push(elem);
      });

      this.ventanas = [...newArray];
    }
  }
  handleTipoTela(event) {
    this.tipoTela = event.detail.value;
  }
  handleTela(event) {
    this.tela = event.detail.value;
  }
  handleMecanismo(event) {
    this.mecanismo = event.detail.value;
  }
  handleCantidad(event) {
    this.cantidad = event.detail.value;
  }
  handleAncho(event) {
    this.ancho = event.detail.value;
  }
  handleAlto(event) {
    this.alto = event.detail.value;
  }
  handleColocacion(event) {
    this.colocacion = event.detail.value;
  }
  handleAgregar() {
    const colocacion = this.colocacion ? this.colocacion : COLOCACION;
    // mts2 de tela + mt linea de mecanismo * cantidad
    const precio = this.calculatePrecio(
      this.alto,
      this.ancho,
      this.telasRecords.find((elem) => elem.Id === this.tela).Precio__c,
      this.mecanismosRecords.find((elem) => elem.Id === this.mecanismo)
        .Precio__c,
      this.cantidad
    );
    const precioSinIva = this.calculatePrecio(
      this.alto,
      this.ancho,
      this.telasRecords.find((elem) => elem.Id === this.tela)
        .PrecioSinFactura__c,
      this.mecanismosRecords.find((elem) => elem.Id === this.mecanismo)
        .PrecioSinFactura__c,
      this.cantidad
    );
    const precioIVA = this.calculatePrecio(
      this.alto,
      this.ancho,
      this.telasRecords.find((elem) => elem.Id === this.tela).PrecioIVA__c,
      this.mecanismosRecords.find((elem) => elem.Id === this.mecanismo)
        .PrecioIVA__c,
      this.cantidad
    );

    let ventana = {
      Tela__c: this.tela,
      telaLink: "/lightning/r/Tela__c/" + this.tela + "/view",
      telaLabel: this.telas.find((elem) => elem.value === this.tela).label,
      Mecanismo__c: this.mecanismo,
      mecanismoLink: this.mecanismos.find(
        (elem) => elem.value === this.mecanismo
      ).label,
      Alto__c: this.alto,
      Ancho__c: this.ancho,
      Ganancia__c: this.ganancia,
      Cantidad__c: this.cantidad,
      Precio__c: precio,
      Colocacion__c: colocacion,
      PrecioSinFactura__c: (precioSinIva + colocacion) * (1 + this.ganancia),
      PrecioFinal__c: (precioIVA + colocacion) * (1 + this.ganancia)
    };
    this.ventanas = [...this.ventanas, ventana];
    this.resetValues();
  }

  handleChangeCantidad(event) {
    console.log(event);
  }

  handleEditCantidad(event) {
    console.log(event);
  }

  calculatePrecio(alto, ancho, precioTela, precioMecanismo, cantidad) {
    // metros2 por precio de tela + precio mecanismo * ancho
    return (alto * ancho * precioTela + precioMecanismo * ancho) * cantidad;
  }

  resetValues() {
    this.tipoTela = undefined;
    this.tela = undefined;
    this.mecanismo = undefined;
    this.ancho = undefined;
    this.alto = undefined;
  }

  handleRowAction(event) {
    const actionName = event.detail.action.name;
    const row = event.detail.row;
    switch (actionName) {
      case "delete":
        this.deleteRow(row);
        break;
      case "edit":
        console.log("edit");
        break;
      default:
    }
  }

  deleteRow(row) {
    const { id } = row;
    const index = this.findRowIndexById(id);
    if (index !== -1) {
      this.ventanas = this.ventanas
        .slice(0, index)
        .concat(this.ventanas.slice(index + 1));
    }
  }

  findRowIndexById(id) {
    let ret = -1;
    this.data.some((row, index) => {
      if (row.id === id) {
        ret = index;
        return true;
      }
      return false;
    });
    return ret;
  }

  get showGuardar() {
    return this.ventanas.length <= 0;
  }

  handleGuardarCotizacion() {
    console.log(JSON.stringify(this.ventanas));
    saveCotization({ ventanas: this.ventanas })
      .then((result) => {
        console.log(result);
        const event = new ShowToastEvent({
          title: "Toast message",
          message: "Se guardo la cotizacion " + result.Name,
          variant: "success",
          mode: "dismissable"
        });
        this.dispatchEvent(event);
        this[NavigationMixin.Navigate]({
          type: "standard__recordPage",
          attributes: {
            recordId: result.Id,
            objectApiName: "Cotizacion__c",
            actionName: "view"
          }
        });
      })
      .catch((error) => {
        const event = new ShowToastEvent({
          title: "Toast message",
          message: error,
          variant: "error",
          mode: "dismissable"
        });
        this.dispatchEvent(event);
      });
  }
}
